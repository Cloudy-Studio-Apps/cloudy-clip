import { createLogger, microsToSeconds, type Micros } from "@/core";
import type { Clip, MediaId, ProjectState, Track } from "@/modules/project";
import type { PreviewEngine } from "../preview.types";

const log = createLogger("preview.engine");

/** Clips starting within this window are prepared ahead so cuts don't stutter. */
const PRELOAD_AHEAD: Micros = 1_500_000;
/** While playing, a media element further than this from the clock is re-seeked. */
const MAX_DRIFT_SECONDS = 0.08;
/** After a seek while playing, give the element this long to catch up before seeking again. */
const SEEK_GRACE_MS = 500;
/** Without `requestVideoFrameCallback`, a seeked frame is assumed decoded after this long. */
const PRESENT_FALLBACK_MS = 250;
/** Media elements kept warm after use; beyond this, idle ones release their decoder. */
const MAX_IDLE_SLOTS = 4;

interface Slot {
  element: HTMLMediaElement;
  kind: "video" | "audio";
  mediaId: MediaId | null;
  /** URL currently loaded. Changes when a file gets its proxy, which forces a reload. */
  url: string | null;
  clipId: string | null;
  /** Target of the seek in flight, to avoid re-issuing it every frame. */
  seekTarget: number | null;
  /** `performance.now()` of the last seek. */
  lastSeekAt: number;
  /**
   * Whether the frame for the current position has actually been decoded. WebKit fires
   * `seeked` before that, so drawing at `seeked` can paint black.
   */
  presented: boolean;
}

interface EngineOptions {
  /** URL that streams a media item. */
  mediaUrl(id: MediaId): string;
  /** Called when a frame becomes available while paused (e.g. a seek finished). */
  onFrameReady(): void;
}

/**
 * Preview engine built on HTML media elements and a 2D canvas.
 *
 * - One pooled `<video>`/`<audio>` per active clip, plus one per clip about to start.
 * - Elements are reused across clips of the same file (a split plays seamlessly).
 * - While playing, elements play natively (hardware decoding, native audio) and are only
 *   re-seeked when they drift from the clock.
 * - Video layers are drawn bottom → top, letterboxed to the project format.
 */
export class HtmlMediaEngine implements PreviewEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly slots: Slot[] = [];
  private readonly assigned = new Map<string, Slot>();
  private settled = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: EngineOptions,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
  }

  render(project: ProjectState, time: Micros, playing: boolean): void {
    const active: Array<{ clip: Clip; track: Track }> = [];
    const upcoming: Clip[] = [];
    for (const trackId of project.trackOrder) {
      const track = project.tracks[trackId];
      if (!track) continue;
      for (const clipId of track.clipIds) {
        const clip = project.clips[clipId];
        if (!clip) continue;
        if (clip.start <= time && time < clip.start + clip.duration) active.push({ clip, track });
        else if (clip.start > time && clip.start - time <= PRELOAD_AHEAD) upcoming.push(clip);
        else if (clip.start > time + PRELOAD_AHEAD) break; // clips are sorted by start
      }
    }

    const needed = new Set<string>();
    for (const { clip } of active) needed.add(clip.id);
    for (const clip of upcoming) needed.add(clip.id);
    this.releaseUnneeded(needed);

    this.settled = true;
    for (const { clip, track } of active) {
      const media = project.media[clip.mediaId];
      if (!media) continue;
      const desired = microsToSeconds(clip.sourceIn + time - clip.start);
      const slot = this.acquire(clip, media.kind, desired);
      if (!slot) continue;
      slot.element.muted = track.muted;
      this.sync(slot, desired, playing);
      if (slot.kind === "video" && !track.hidden && !this.hasFrame(slot)) this.settled = false;
    }
    for (const clip of upcoming) {
      const media = project.media[clip.mediaId];
      if (!media) continue;
      const slot = this.acquire(clip, media.kind, microsToSeconds(clip.sourceIn));
      if (!slot) continue;
      slot.element.muted = true;
      this.sync(slot, microsToSeconds(clip.sourceIn), false);
    }

    // Slots that lost their clip this frame must go quiet.
    for (const slot of this.slots) {
      if (slot.clipId === null && !slot.element.paused) slot.element.pause();
    }

    // Only paint complete frames: a layer still decoding would flash black. Keep the previous
    // picture instead; the controller retries until every layer has its frame.
    if (this.settled) this.draw(project, active);
  }

  pauseAll(): void {
    for (const slot of this.slots) if (!slot.element.paused) slot.element.pause();
  }

  isSettled(): boolean {
    return this.settled;
  }

  captureFrame(): string {
    return this.canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  }

  dispose(): void {
    for (const slot of this.slots) this.unload(slot);
    this.slots.length = 0;
    this.assigned.clear();
  }

  /** Frees slots whose clip is no longer active or upcoming. */
  private releaseUnneeded(needed: Set<string>): void {
    for (const [clipId, slot] of this.assigned) {
      if (needed.has(clipId)) continue;
      this.assigned.delete(clipId);
      slot.clipId = null;
    }
  }

  /**
   * Returns the slot for a clip, assigning one if needed. Preference: a free slot already on
   * the same file near the wanted time (no seek), then any free slot on the same file, then any
   * free slot of the same kind, then a new element.
   */
  private acquire(clip: Clip, kind: "video" | "audio", desired: number): Slot | null {
    const url = this.options.mediaUrl(clip.mediaId);
    const existing = this.assigned.get(clip.id);
    if (existing) {
      if (existing.url !== url) this.load(existing, clip.mediaId, url);
      return existing;
    }

    let best: Slot | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const slot of this.slots) {
      if (slot.clipId !== null || slot.kind !== kind) continue;
      const sameFile = slot.url === url;
      const distance = sameFile ? Math.abs(slot.element.currentTime - desired) : Infinity;
      const score = sameFile ? distance : 1e9;
      if (score < bestScore) {
        best = slot;
        bestScore = score;
      }
    }

    const slot = best ?? this.createSlot(kind);
    if (slot.url !== url) this.load(slot, clip.mediaId, url);
    slot.clipId = clip.id;
    this.assigned.set(clip.id, slot);
    this.trimIdle();
    return slot;
  }

  private load(slot: Slot, mediaId: MediaId, url: string): void {
    slot.mediaId = mediaId;
    slot.url = url;
    slot.seekTarget = null;
    slot.presented = false;
    slot.element.src = url;
  }

  /** Whether a slot can be drawn right now. Broken media never blocks the other layers. */
  private hasFrame(slot: Slot): boolean {
    const element = slot.element;
    if (element.error) return true;
    return (
      slot.presented && !element.seeking && element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    );
  }

  /** Marks the slot presented once its new frame is really decoded, then asks for a redraw. */
  private watchForFrame(slot: Slot): void {
    const element = slot.element;
    const done = () => {
      if (slot.presented) return;
      slot.presented = true;
      this.options.onFrameReady();
    };
    if (element instanceof HTMLVideoElement && "requestVideoFrameCallback" in element) {
      element.requestVideoFrameCallback(done);
    }
    // Fallback (and safety net if the callback never fires for an off-screen element).
    setTimeout(() => {
      if (!element.seeking && element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) done();
      else this.options.onFrameReady();
    }, PRESENT_FALLBACK_MS);
  }

  private createSlot(kind: "video" | "audio"): Slot {
    const element = document.createElement(kind);
    element.crossOrigin = "anonymous";
    element.preload = "auto";
    if (element instanceof HTMLVideoElement) element.playsInline = true;
    const slot: Slot = {
      element,
      kind,
      mediaId: null,
      url: null,
      clipId: null,
      seekTarget: null,
      lastSeekAt: 0,
      presented: false,
    };
    element.addEventListener("seeked", () => {
      slot.seekTarget = null;
      this.watchForFrame(slot);
    });
    element.addEventListener("loadeddata", () => this.watchForFrame(slot));
    element.addEventListener("error", () => {
      log.warn(`Media "${slot.mediaId}" failed to load`, element.error?.message);
    });
    this.slots.push(slot);
    return slot;
  }

  /** Keeps the element on the clock: plays/pauses it and seeks only when needed. */
  private sync(slot: Slot, desired: number, playing: boolean): void {
    const element = slot.element;
    const drift = Math.abs(element.currentTime - desired);
    const pendingSeek =
      slot.seekTarget !== null && Math.abs(slot.seekTarget - desired) < MAX_DRIFT_SECONDS;

    if (playing) {
      const inGrace = performance.now() - slot.lastSeekAt < SEEK_GRACE_MS;
      const tooFar = drift > (inGrace ? 0.5 : MAX_DRIFT_SECONDS);
      if (tooFar && !pendingSeek) this.seek(slot, desired);
      if (element.paused) {
        element.play().catch((error: unknown) => {
          // Autoplay with sound can be refused (e.g. playback started by an agent). Retry muted.
          if (!element.muted) {
            log.warn("Playback with sound was blocked; playing muted", error);
            element.muted = true;
            element.play().catch(() => undefined);
          }
        });
      }
      return;
    }

    if (!element.paused) element.pause();
    // While paused, aim for frame accuracy (half a frame at 60 fps).
    if (drift > 0.008 && !pendingSeek) this.seek(slot, desired);
  }

  private seek(slot: Slot, to: number): void {
    slot.seekTarget = to;
    slot.lastSeekAt = performance.now();
    slot.presented = false;
    slot.element.currentTime = to;
  }

  /** Releases decoders of idle slots beyond the warm limit. */
  private trimIdle(): void {
    const idle = this.slots.filter((s) => s.clipId === null && s.mediaId !== null);
    for (const slot of idle.slice(0, Math.max(0, idle.length - MAX_IDLE_SLOTS))) {
      this.unload(slot);
    }
  }

  private unload(slot: Slot): void {
    slot.element.pause();
    slot.element.removeAttribute("src");
    slot.element.load();
    slot.mediaId = null;
    slot.url = null;
    slot.seekTarget = null;
  }

  private draw(project: ProjectState, active: Array<{ clip: Clip; track: Track }>): void {
    const { ctx, canvas } = this;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // trackOrder is top → bottom; draw bottom first so higher tracks end up on top.
    for (let i = active.length - 1; i >= 0; i--) {
      const { clip, track } = active[i]!;
      if (track.kind !== "video" || track.hidden) continue;
      if (project.media[clip.mediaId]?.kind !== "video") continue;
      const element = this.assigned.get(clip.id)?.element;
      if (!(element instanceof HTMLVideoElement)) continue;
      if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.videoWidth === 0)
        continue;

      const scale = Math.min(
        canvas.width / element.videoWidth,
        canvas.height / element.videoHeight,
      );
      const width = element.videoWidth * scale;
      const height = element.videoHeight * scale;
      ctx.drawImage(
        element,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
    }
  }
}
