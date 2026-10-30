import { microsToSeconds, type Micros } from "@/core";
import { canvasTextMeasure, mergeProps, type PictureDefinition } from "@/modules/element";
import {
  clipPlacement,
  clipTransform,
  type Clip,
  type ClipId,
  type ClipTransform,
  type MediaId,
  type ProjectState,
  type Track,
} from "@/modules/project";
import { soundGains } from "../logic/junctions";
import { picturesSettled } from "../logic/readiness";
import type { PreviewEngine } from "../preview.types";
import { quietSlot, voiceSlot } from "./engine.audio";
import { MixCanvases, drawTrack } from "./engine.mix";
import { MediaSlotPool } from "./engine.slots";
import { syncSlot } from "./engine.sync";
import type { ActiveTrack, EngineOptions } from "./engine.types";

/** Whether a clip plays a file (media clips). */
function hasMedia(clip: Clip): clip is Clip & { mediaId: MediaId } {
  return clip.mediaId !== undefined;
}

/** Clips starting within this window are prepared ahead so cuts don't stutter. */
const PRELOAD_AHEAD: Micros = 1_500_000;

/**
 * Preview engine built on HTML media elements and a 2D canvas.
 *
 * - One pooled `<video>`/`<audio>` per active clip, plus one per clip about to start.
 * - Elements are reused across clips of the same file (a split plays seamlessly). Two clips that
 *   overlap under a junction are both active, so each has its own element (a split with a
 *   junction between its halves plays both halves at once).
 * - While playing, elements play natively (hardware decoding, native audio) and are only
 *   re-seeked when they drift from the clock.
 * - Video layers are drawn bottom → top, letterboxed to the project format. Under a junction, the
 *   two clips of a track are drawn offscreen and combined by the junction kind's `mix`.
 */
export class HtmlMediaEngine implements PreviewEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pool: MediaSlotPool;
  private settled = true;
  private readonly ensureFont: EngineOptions["ensureFont"];
  private readonly elements: EngineOptions["elements"];
  private readonly junctions: EngineOptions["junctions"];
  private readonly mixCanvases: MixCanvases;
  private readonly pictureOnly: boolean;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: EngineOptions,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.pool = new MediaSlotPool(options);
    this.ensureFont = options.ensureFont;
    this.elements = options.elements;
    this.junctions = options.junctions;
    this.mixCanvases = new MixCanvases(canvas);
    this.pictureOnly = options.pictureOnly ?? false;
  }

  render(
    project: ProjectState,
    time: Micros,
    playing: boolean,
    transforms: ReadonlyMap<ClipId, ClipTransform> = new Map(),
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>> = new Map(),
  ): void {
    const active: ActiveTrack[] = [];
    const upcoming: Array<{ clip: Clip; track: Track }> = [];
    for (const trackId of project.trackOrder) {
      const track = project.tracks[trackId];
      if (!track) continue;
      if (this.pictureOnly && track.kind !== "video") continue;
      const here: ActiveTrack = { track, clips: [] };
      active.push(here);
      for (const clipId of track.clipIds) {
        const clip = project.clips[clipId];
        if (!clip) continue;
        if (clip.start <= time && time < clip.start + clip.duration) here.clips.push(clip);
        else if (clip.start > time && clip.start - time <= PRELOAD_AHEAD)
          upcoming.push({ clip, track });
        else if (clip.start > time + PRELOAD_AHEAD) break; // clips are sorted by start
      }
    }

    const needed = new Set<string>();
    for (const { clips } of active) for (const clip of clips) needed.add(clip.id);
    for (const { clip } of upcoming) needed.add(clip.id);
    this.pool.release(needed);

    // Sound clips crossfading under a junction (junction rule 4); others play at full volume.
    const gains = soundGains(project, time);
    this.settled = true;
    for (const { track, clips } of active) {
      // During a junction's overlap both clips are here, each on its own element (one per clip
      // id), and both frames must be ready before anything is painted.
      for (const clip of clips) {
        if (!hasMedia(clip)) continue; // drawn from the document, no media element
        const media = project.media[clip.mediaId];
        if (!media) continue;
        const desired = microsToSeconds(clip.sourceIn + time - clip.start);
        // The track decides the element: pictures come from video tracks (always silent), sound
        // from audio tracks (a video file's sound plays through an <audio> on the same URL).
        const slot = this.pool.acquire(clip, track.kind, desired);
        if (!slot) continue;
        voiceSlot(slot, track, gains.get(clip.id) ?? 1);
        syncSlot(slot, desired, playing);
        if (slot.kind === "video" && !track.hidden && !this.pool.hasFrame(slot))
          this.settled = false;
      }
    }
    const pictures = active
      .filter(({ track }) => track.kind === "video")
      .flatMap(({ track, clips }) =>
        clips.filter((clip) => !hasMedia(clip)).map((clip) => ({ clip, hidden: track.hidden })),
      );
    const ready = (clip: Clip) =>
      this.pictureReady(project, clip, time, propsOverrides.get(clip.id));
    if (!picturesSettled(pictures, ready)) this.settled = false;

    for (const { clip, track } of upcoming) {
      if (!hasMedia(clip)) {
        // Asked ahead, so its picture is loaded by the time it shows.
        this.pictureReady(project, clip, clip.start, propsOverrides.get(clip.id));
        continue;
      }
      if (!project.media[clip.mediaId]) continue;
      const slot = this.pool.acquire(clip, track.kind, microsToSeconds(clip.sourceIn));
      if (!slot) continue;
      quietSlot(slot, track);
      syncSlot(slot, microsToSeconds(clip.sourceIn), false);
    }

    // Slots that lost their clip this frame must go quiet.
    this.pool.pauseIdle();

    // Only paint complete frames: a layer still decoding would flash black. Keep the previous
    // picture instead; the controller retries until every layer has its frame.
    if (this.settled) this.draw(project, time, active, transforms, propsOverrides);
  }

  pauseAll(): void {
    this.pool.pauseAll();
  }

  isSettled(): boolean {
    return this.settled;
  }

  captureFrame(): Promise<string> {
    // `toBlob`, not `toDataURL`: a capture must not stall the user's playback while encoding.
    return new Promise((resolve, reject) => {
      this.canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("The frame could not be encoded"));
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("The frame could not be read"));
        reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
        reader.readAsDataURL(blob);
      }, "image/png");
    });
  }

  dispose(): void {
    this.pool.dispose();
    this.mixCanvases.dispose();
  }

  private draw(
    project: ProjectState,
    time: Micros,
    active: ActiveTrack[],
    transforms: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Canvas pixels per output pixel (the canvas keeps the format's aspect ratio).
    const kx = canvas.width / project.format.width;
    const ky = canvas.height / project.format.height;
    const drawClip = (target: CanvasRenderingContext2D, clip: Clip) =>
      this.drawClip(target, project, clip, time, transforms, propsOverrides, kx, ky);

    // trackOrder is top → bottom; draw bottom first so higher tracks end up on top.
    for (let i = active.length - 1; i >= 0; i--) {
      const { track, clips } = active[i]!;
      if (track.kind !== "video" || track.hidden) continue;
      drawTrack(ctx, { project, track, clips, time }, this.mixCanvases, this.junctions, drawClip);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Draws one clip onto `target` at its placement: a media frame or the element's own `draw`. */
  private drawClip(
    target: CanvasRenderingContext2D,
    project: ProjectState,
    clip: Clip,
    time: Micros,
    transforms: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
    kx: number,
    ky: number,
  ): void {
    // The canvas gesture wins; else a panel's live transform patch over the saved one.
    const live = propsOverrides.get(clip.id)?.transform as Partial<ClipTransform> | undefined;
    const transform = transforms.get(clip.id) ?? clipTransform(clip, live);
    const picture = this.elements.get(clip.kind)?.definition.picture;
    if (!picture) return;
    if (picture.source !== "media") {
      this.drawPicture(
        target,
        picture,
        project,
        clip,
        time,
        transform,
        propsOverrides.get(clip.id),
        kx,
        ky,
      );
      return;
    }
    if (!hasMedia(clip) || project.media[clip.mediaId]?.kind !== "video") return;
    const element = this.pool.elementOf(clip.id);
    if (!(element instanceof HTMLVideoElement)) return;
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.videoWidth === 0) return;

    const place = clipPlacement(
      project.format,
      { width: element.videoWidth, height: element.videoHeight },
      transform,
    );
    target.setTransform(kx, 0, 0, ky, 0, 0);
    target.translate(place.cx, place.cy);
    target.rotate((place.rotation * Math.PI) / 180);
    target.drawImage(element, -place.width / 2, -place.height / 2, place.width, place.height);
  }

  /** Draws an element that paints itself (text, a plugin's), at its placement. */
  private drawPicture(
    target: CanvasRenderingContext2D,
    picture: PictureDefinition<Record<string, unknown>>,
    project: ProjectState,
    clip: Clip,
    time: Micros,
    transform: ClipTransform,
    override: Record<string, unknown> | undefined,
    kx: number,
    ky: number,
  ): void {
    if (!picture.size || !picture.draw) return;
    const saved = this.elements.resolve(clip, project.format);
    const props = override ? mergeProps(saved, override) : saved;
    const measure = canvasTextMeasure(this.ctx);
    const size = picture.size(props, { format: project.format, measure });
    const placement = clipPlacement(project.format, size, transform, picture.fit);
    const env = {
      format: project.format,
      placement,
      time: time - clip.start,
      kx,
      ky,
      measure,
      ensureFont: this.ensureFont,
    };
    picture.draw(target, props, env);
  }

  /** Whether a clip that paints itself can paint at `time`; asking may start its loading. */
  private pictureReady(
    project: ProjectState,
    clip: Clip,
    time: Micros,
    override: Record<string, unknown> | undefined,
  ): boolean {
    const picture = this.elements.get(clip.kind)?.definition.picture;
    if (!picture?.ready) return true;
    const saved = this.elements.resolve(clip, project.format);
    const props = override ? mergeProps(saved, override) : saved;
    return picture.ready(props, { time: time - clip.start });
  }
}
