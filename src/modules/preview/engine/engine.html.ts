import { microsToSeconds, type Micros } from "@/core";
import {
  clipPlacement,
  clipTransform,
  mergeTextStyle,
  textStyleOf,
  type Clip,
  type ClipId,
  type ClipTransform,
  type ProjectState,
  type Track,
} from "@/modules/project";
import type { PreviewEngine, TextOverride } from "../preview.types";
import { MediaSlotPool } from "./engine.slots";
import { syncSlot } from "./engine.sync";
import { drawText } from "./engine.text";
import type { EngineOptions } from "./engine.types";

/** Clips starting within this window are prepared ahead so cuts don't stutter. */
const PRELOAD_AHEAD: Micros = 1_500_000;

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
  private readonly pool: MediaSlotPool;
  private settled = true;
  private readonly ensureFont: EngineOptions["ensureFont"];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: EngineOptions,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.pool = new MediaSlotPool(options);
    this.ensureFont = options.ensureFont;
  }

  render(
    project: ProjectState,
    time: Micros,
    playing: boolean,
    transforms: ReadonlyMap<ClipId, ClipTransform> = new Map(),
    textOverrides: ReadonlyMap<ClipId, TextOverride> = new Map(),
  ): void {
    const active: Array<{ clip: Clip; track: Track }> = [];
    const upcoming: Array<{ clip: Clip; track: Track }> = [];
    for (const trackId of project.trackOrder) {
      const track = project.tracks[trackId];
      if (!track) continue;
      for (const clipId of track.clipIds) {
        const clip = project.clips[clipId];
        if (!clip) continue;
        if (clip.start <= time && time < clip.start + clip.duration) active.push({ clip, track });
        else if (clip.start > time && clip.start - time <= PRELOAD_AHEAD)
          upcoming.push({ clip, track });
        else if (clip.start > time + PRELOAD_AHEAD) break; // clips are sorted by start
      }
    }

    const needed = new Set<string>();
    for (const { clip } of active) needed.add(clip.id);
    for (const { clip } of upcoming) needed.add(clip.id);
    this.pool.release(needed);

    this.settled = true;
    for (const { clip, track } of active) {
      if (clip.kind === "text") continue; // drawn from the document, no media element
      const media = project.media[clip.mediaId];
      if (!media) continue;
      const desired = microsToSeconds(clip.sourceIn + time - clip.start);
      // The track decides the element: pictures come from video tracks (always silent), sound
      // from audio tracks (a video file's sound plays through an <audio> on the same URL).
      const slot = this.pool.acquire(clip, track.kind, desired);
      if (!slot) continue;
      // Silence pictures with volume, not `muted`: WebKitGTK stops handing a muted <video>'s
      // frames to the canvas (the preview stays black).
      slot.element.muted = track.kind === "audio" && track.muted;
      slot.element.volume = track.kind === "video" ? 0 : 1;
      syncSlot(slot, desired, playing);
      if (slot.kind === "video" && !track.hidden && !this.pool.hasFrame(slot)) this.settled = false;
    }
    for (const { clip, track } of upcoming) {
      if (clip.kind === "text" || !project.media[clip.mediaId]) continue;
      const slot = this.pool.acquire(clip, track.kind, microsToSeconds(clip.sourceIn));
      if (!slot) continue;
      slot.element.muted = true;
      syncSlot(slot, microsToSeconds(clip.sourceIn), false);
    }

    // Slots that lost their clip this frame must go quiet.
    this.pool.pauseIdle();

    // Only paint complete frames: a layer still decoding would flash black. Keep the previous
    // picture instead; the controller retries until every layer has its frame.
    if (this.settled) this.draw(project, active, transforms, textOverrides);
  }

  pauseAll(): void {
    this.pool.pauseAll();
  }

  isSettled(): boolean {
    return this.settled;
  }

  captureFrame(): string {
    return this.canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  }

  dispose(): void {
    this.pool.dispose();
  }

  private draw(
    project: ProjectState,
    active: Array<{ clip: Clip; track: Track }>,
    transforms: ReadonlyMap<ClipId, ClipTransform>,
    textOverrides: ReadonlyMap<ClipId, TextOverride>,
  ): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Canvas pixels per output pixel (the canvas keeps the format's aspect ratio).
    const kx = canvas.width / project.format.width;
    const ky = canvas.height / project.format.height;

    // trackOrder is top → bottom; draw bottom first so higher tracks end up on top.
    for (let i = active.length - 1; i >= 0; i--) {
      const { clip, track } = active[i]!;
      if (track.kind !== "video" || track.hidden) continue;
      const transform = transforms.get(clip.id) ?? clipTransform(clip);
      if (clip.kind === "text") {
        const override = textOverrides.get(clip.id);
        const saved = textStyleOf(clip, project.format);
        const style = override?.style ? mergeTextStyle(saved, override.style) : saved;
        const text = override?.text ?? clip.text;
        drawText(ctx, project.format, style, text, transform, kx, ky, this.ensureFont);
        continue;
      }
      if (project.media[clip.mediaId]?.kind !== "video") continue;
      const element = this.pool.elementOf(clip.id);
      if (!(element instanceof HTMLVideoElement)) continue;
      if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.videoWidth === 0)
        continue;

      const place = clipPlacement(
        project.format,
        { width: element.videoWidth, height: element.videoHeight },
        transform,
      );
      ctx.setTransform(kx, 0, 0, ky, 0, 0);
      ctx.translate(place.cx, place.cy);
      ctx.rotate((place.rotation * Math.PI) / 180);
      ctx.drawImage(element, -place.width / 2, -place.height / 2, place.width, place.height);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
