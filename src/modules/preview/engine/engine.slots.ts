import { createLogger } from "@/core";
import type { Clip, MediaId } from "@/modules/project";
import { INITIAL_SEEK_COST } from "../logic/drift";
import type { EngineOptions, Slot } from "./engine.types";

const log = createLogger("preview.engine");

/** Without `requestVideoFrameCallback`, a seeked frame is assumed decoded after this long. */
const PRESENT_FALLBACK_MS = 250;
/** Media elements kept warm after use; beyond this, idle ones release their decoder. */
const MAX_IDLE_SLOTS = 4;

/**
 * Pooled `<video>`/`<audio>` elements, one per active or upcoming clip. Elements are reused
 * across clips of the same file (a split plays seamlessly), and idle ones beyond a small warm
 * set release their decoder. Only a *free* element is reused: two clips needed at once (the two
 * halves of a split joined by a junction, overlapping) always get two elements.
 */
export class MediaSlotPool {
  private readonly slots: Slot[] = [];
  private readonly assigned = new Map<string, Slot>();

  constructor(private readonly options: EngineOptions) {}

  /** The element showing a clip at a path, if it has one. */
  elementOf(path: string): HTMLMediaElement | undefined {
    return this.assigned.get(path)?.element;
  }

  /** Pauses elements whose clip went away this frame, so they go quiet. */
  pauseIdle(): void {
    for (const slot of this.slots) {
      if (slot.path === null && !slot.element.paused) slot.element.pause();
    }
  }

  pauseAll(): void {
    for (const slot of this.slots) if (!slot.element.paused) slot.element.pause();
  }

  dispose(): void {
    for (const slot of this.slots) this.unload(slot);
    this.slots.length = 0;
    this.assigned.clear();
  }

  /** Frees slots whose clip is no longer active or upcoming (the elements stay warm). */
  release(needed: Set<string>): void {
    for (const [path, slot] of this.assigned) {
      if (needed.has(path)) continue;
      this.assigned.delete(path);
      slot.path = null;
    }
  }

  /**
   * Returns the slot for a clip, assigning one if needed. Preference: a free slot already on
   * the same file near the wanted time (no seek), then any free slot on the same file, then any
   * free slot of the same kind, then a new element.
   */
  acquire(
    path: string,
    clip: Clip & { mediaId: MediaId },
    kind: "video" | "audio",
    desired: number,
  ): Slot | null {
    const url = this.options.mediaUrl(clip.mediaId);
    const existing = this.assigned.get(path);
    if (existing) {
      if (existing.url !== url) this.load(existing, clip.mediaId, url);
      return existing;
    }

    let best: Slot | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const slot of this.slots) {
      if (slot.path !== null || slot.kind !== kind) continue;
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
    slot.path = path;
    this.assigned.set(path, slot);
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
  hasFrame(slot: Slot): boolean {
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
      path: null,
      seekTarget: null,
      lastSeekAt: 0,
      seekCost: INITIAL_SEEK_COST,
      presented: false,
    };
    element.addEventListener("seeked", () => {
      slot.seekCost = (performance.now() - slot.lastSeekAt) / 1000;
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

  /** Releases decoders of idle slots beyond the warm limit. */
  private trimIdle(): void {
    const idle = this.slots.filter((s) => s.path === null && s.mediaId !== null);
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
}
