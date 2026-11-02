import { microsToSeconds, type Micros } from "@/core";
import { canvasTextMeasure, mergeProps, type PictureDefinition } from "@/modules/element";
import {
  clipPlacement,
  clipTransform,
  formatOf,
  type Clip,
  dbToLinear,
  fadeLevel,
  pitchShift,
  soundOf,
  type ClipId,
  type ClipPlacement,
  type ClipSound,
  type ClipTransform,
  type Composition,
  type MediaAsset,
  type MediaId,
  type ProjectFormat,
  type ProjectState,
} from "@/modules/project";
import { resolveFrame } from "../logic/frame";
import { soundGains } from "../logic/junctions";
import { picturesSettled } from "../logic/readiness";
import type { PreviewEngine } from "../preview.types";
import { quietSlot, voiceSlot } from "./engine.audio";
import { createSoundGraph, PITCH_LEAD_SECONDS } from "./engine.audiograph";
import { ImageCache } from "./engine.images";
import { LevelCorrection } from "./engine.levels";
import { MixCanvases, drawTrack } from "./engine.mix";
import { NestedCanvases } from "./engine.nested";
import { MediaSlotPool } from "./engine.slots";
import { syncSlot } from "./engine.sync";
import type {
  CachedPicture,
  EngineOptions,
  PlacementTarget,
  ResolvedFrame,
  SoundGraph,
} from "./engine.types";

/** Whether a clip plays a file (media clips). */
function hasMedia(clip: Clip): clip is Clip & { mediaId: MediaId } {
  return clip.mediaId !== undefined;
}

/** Clips starting within this window are prepared ahead so cuts don't stutter. */
const PRELOAD_AHEAD: Micros = 1_500_000;
/** Frames of an animated image loaded ahead of the one showing, so it plays without stalling. */
const PRELOAD_FRAMES: Micros = 1_000_000;

/** No gesture or live patch: what clips inside a placement are drawn with. */
const NOTHING = new Map();

/** Draws a picture at its placement. `kx` and `ky` are canvas pixels per output pixel. */
function land(
  target: CanvasRenderingContext2D,
  source: CanvasImageSource,
  place: ClipPlacement,
  kx: number,
  ky: number,
): void {
  target.setTransform(kx, 0, 0, ky, 0, 0);
  target.translate(place.cx, place.cy);
  target.rotate((place.rotation * Math.PI) / 180);
  target.drawImage(source, -place.width / 2, -place.height / 2, place.width, place.height);
}

/**
 * Preview engine built on HTML media elements and a 2D canvas.
 *
 * - One pooled `<video>`/`<audio>` per active clip, plus one per clip about to start.
 * - Elements are reused across clips of the same file (a split plays seamlessly). Two clips that
 *   overlap under a junction are both active, so each has its own element (a split with a
 *   junction between its halves plays both halves at once).
 * - While playing, elements play natively (hardware decoding, native audio) and are only
 *   re-seeked when they drift from the clock.
 * - Images never take an element: stills and the frames of animated images come from `ImageCache`.
 * - Video layers are drawn bottom → top, letterboxed to the project format. Under a junction, the
 *   two clips of a track are drawn offscreen and combined by the junction kind's `mix`.
 */
export class HtmlMediaEngine implements PreviewEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pool: MediaSlotPool;
  private readonly images: ImageCache;
  private readonly imageFrames: EngineOptions["imageFrames"];
  private settled = true;
  private readonly ensureFont: EngineOptions["ensureFont"];
  private readonly elements: EngineOptions["elements"];
  private readonly junctions: EngineOptions["junctions"];
  private readonly mixCanvases: MixCanvases;
  private readonly nested = new NestedCanvases();
  private readonly pictureOnly: boolean;
  /** Web Audio for clips with sound settings; a picture-only engine has no sound. */
  private readonly sound: SoundGraph | null;
  private readonly levels: LevelCorrection | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: EngineOptions,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.pool = new MediaSlotPool(options);
    this.images = new ImageCache(options.onFrameReady);
    this.imageFrames = options.imageFrames;
    this.ensureFont = options.ensureFont;
    this.elements = options.elements;
    this.junctions = options.junctions;
    this.mixCanvases = new MixCanvases(canvas);
    this.pictureOnly = options.pictureOnly ?? false;
    this.sound = this.pictureOnly ? null : createSoundGraph();
    this.levels = options.videoLevels ? new LevelCorrection(options.videoLevels) : null;
  }

  render(
    project: ProjectState,
    composition: Composition,
    time: Micros,
    playing: boolean,
    transforms: ReadonlyMap<ClipId, ClipTransform> = new Map(),
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>> = new Map(),
  ): void {
    const frame = resolveFrame(project, composition.id, time, {
      pictureOnly: this.pictureOnly,
      preloadAhead: PRELOAD_AHEAD,
    });
    const needed = new Set<string>();
    const placements = new Set<string>();
    const collect = ({ tracks, upcoming }: ResolvedFrame) => {
      for (const { path } of upcoming) needed.add(path);
      for (const { clips } of tracks) {
        for (const { path, inner } of clips) {
          if (inner) {
            placements.add(path);
            collect(inner);
          } else needed.add(path);
        }
      }
    };
    collect(frame);
    this.pool.release(needed);
    this.nested.release(placements);

    this.settled = true;
    this.prepare(project, frame, playing, propsOverrides, 1, false);

    for (const { path, clip, track, time: at } of frame.upcoming) {
      if (!hasMedia(clip)) {
        // Asked ahead, so its picture is loaded by the time it shows.
        const format = formatOf(project, clip);
        this.pictureReady(format, clip, clip.start, propsOverrides.get(clip.id));
        continue;
      }
      const media = project.media[clip.mediaId];
      if (!media) continue;
      if (media.kind === "image") {
        this.wantImage(media, 0);
        continue;
      }
      const seconds = microsToSeconds(clip.sourceIn + at - clip.start);
      const slot = this.pool.acquire(path, clip, track.kind, seconds);
      if (!slot) continue;
      quietSlot(slot, track, this.sound);
      syncSlot(slot, seconds, false);
    }

    // Slots that lost their clip this frame must go quiet.
    this.pool.pauseIdle();

    // Only paint complete frames: a layer still decoding would flash black. Keep the previous
    // picture instead; the controller retries until every layer has its frame.
    if (this.settled) this.draw(project, frame, transforms, propsOverrides);
  }

  /**
   * Gets every element of a frame in place, at any depth, and checks what can be painted. `gain`
   * and `silenced` come from the tracks around a placement.
   */
  private prepare(
    project: ProjectState,
    { composition, time, tracks }: ResolvedFrame,
    playing: boolean,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
    gain: number,
    silenced: boolean,
  ): void {
    // Sound clips crossfading under a junction (junction rule 4); others play at full volume.
    const gains = soundGains(project, composition, time);
    for (const { track, clips } of tracks) {
      // During a junction's overlap both clips are here, each on its own element (one per path),
      // and both frames must be ready before anything is painted.
      for (const { clip, path, inner } of clips) {
        const sound = (propsOverrides.get(clip.id)?.sound as ClipSound) ?? soundOf(clip);
        const crossfade = gains.get(clip.id) ?? 1;
        // The longer of a crossfade and the clip's own fade wins, as in export: a smaller share.
        const own =
          track.kind === "audio"
            ? gain * Math.min(crossfade, fadeLevel(sound, clip, time)) * dbToLinear(sound.volumeDb)
            : gain * crossfade;
        if (inner) {
          this.prepare(project, inner, playing, propsOverrides, own, silenced || track.muted);
          continue;
        }
        if (!hasMedia(clip)) continue; // drawn from the document, no media element
        const media = project.media[clip.mediaId];
        if (!media) continue;
        if (media.kind === "image") {
          // Never a pooled element: the picture comes from the cache, at the clip's own time.
          const current = this.wantImage(media, time - clip.start);
          if (!track.hidden && !this.images.ready(current)) this.settled = false;
          continue;
        }
        const desired = microsToSeconds(clip.sourceIn + time - clip.start);
        // The track decides the element: pictures come from video tracks (always silent), sound
        // from audio tracks (a video file's sound plays through an <audio> on the same URL).
        const slot = this.pool.acquire(path, clip, track.kind, desired);
        if (!slot) continue;
        voiceSlot(slot, track, own, silenced, sound, this.sound);
        const pitched = playing && track.kind === "audio" && pitchShift(sound) !== 0;
        syncSlot(slot, pitched ? desired + PITCH_LEAD_SECONDS : desired, playing);
        if (slot.kind === "video" && !track.hidden && !this.pool.hasFrame(slot)) {
          this.settled = false;
        }
      }
    }
    const pictures = tracks
      .filter(({ track }) => track.kind === "video")
      .flatMap(({ track, clips }) =>
        clips
          .filter(({ clip, inner }) => !hasMedia(clip) && !inner)
          .map(({ clip }) => ({ clip, hidden: track.hidden })),
      );
    const ready = (clip: Clip) =>
      this.pictureReady(composition.format, clip, time, propsOverrides.get(clip.id));
    if (!picturesSettled(pictures, ready)) this.settled = false;
  }

  /** Asks for an image's picture at a moment of its clip and what follows. Returns its URL. */
  private wantImage(asset: MediaAsset, elapsed: Micros): string {
    const raster = asset.name.toLowerCase().endsWith(".svg");
    const urls = this.imageFrames(asset.id, elapsed, PRELOAD_FRAMES);
    for (const url of urls) this.images.want(url, { raster });
    return urls[0]!;
  }

  pauseAll(): void {
    this.pool.pauseAll();
  }

  isSettled(): boolean {
    return this.settled;
  }

  readPixels(): Uint8ClampedArray {
    const { width, height } = this.canvas;
    return this.ctx.getImageData(0, 0, width, height).data;
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
    this.sound?.dispose();
    this.images.dispose();
    this.mixCanvases.dispose();
    this.nested.dispose();
  }

  private draw(
    project: ProjectState,
    frame: ResolvedFrame,
    transforms: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = frame.composition.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.drawFrame(ctx, this.mixCanvases, project, frame, "", transforms, propsOverrides);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Draws a frame's pictures onto `target`, which is sized like its composition's format. */
  private drawFrame(
    target: CanvasRenderingContext2D,
    mix: MixCanvases,
    project: ProjectState,
    { composition, time, tracks }: ResolvedFrame,
    prefix: string,
    transforms: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): void {
    const { format } = composition;
    // Canvas pixels per output pixel (the canvas keeps the format's aspect ratio).
    const kx = target.canvas.width / format.width;
    const ky = target.canvas.height / format.height;
    const pathOf = (clip: Clip) => (prefix ? `${prefix}/${clip.id}` : clip.id);
    const inners = new Map<ClipId, ResolvedFrame>();
    for (const { clips } of tracks) {
      for (const { clip, inner } of clips) if (inner) inners.set(clip.id, inner);
    }
    const drawClip = (on: CanvasRenderingContext2D, clip: Clip) => {
      const live = propsOverrides.get(clip.id)?.transform as Partial<ClipTransform> | undefined;
      const transform = transforms.get(clip.id) ?? clipTransform(clip, live);
      const inner = inners.get(clip.id);
      if (inner) {
        const box = { on, format, kx, ky };
        this.drawPlacement(box, project, inner, pathOf(clip), transform);
        return;
      }
      const media = clip.mediaId ? project.media[clip.mediaId] : undefined;
      if (media?.kind === "image") {
        const [url] = this.imageFrames(media.id, time - clip.start, 0);
        const picture = url ? this.images.picture(url) : undefined;
        if (picture) this.drawCached(on, format, picture, transform, kx, ky);
        return;
      }
      this.drawClip(on, format, clip, pathOf(clip), time, transform, propsOverrides, kx, ky);
    };

    // Tracks are top → bottom; draw bottom first so higher tracks end up on top.
    for (let i = tracks.length - 1; i >= 0; i--) {
      const { track, clips } = tracks[i]!;
      if (track.kind !== "video" || track.hidden) continue;
      drawTrack(
        target,
        { project, format, track, clips: clips.map(({ clip }) => clip), time },
        mix,
        this.junctions,
        drawClip,
      );
    }
  }

  /**
   * Draws a composition clip: its frame goes into a transparent canvas, which lands like a video
   * frame. Inside, clips are drawn as saved: live gestures only touch the composition that's open.
   */
  private drawPlacement(
    { on, format, kx, ky }: PlacementTarget,
    project: ProjectState,
    inner: ResolvedFrame,
    path: string,
    transform: ClipTransform,
  ): void {
    const size = inner.composition.format;
    // No sharper than the preview itself: a 4K composition in a small window stays cheap.
    const limit = Math.max(this.canvas.width, this.canvas.height);
    const ratio = Math.min(1, limit / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * ratio));
    const height = Math.max(1, Math.round(size.height * ratio));
    const nested = this.nested.take(path, width, height);
    this.drawFrame(nested.ctx, nested.mix, project, inner, path, NOTHING, NOTHING);
    land(on, nested.ctx.canvas, clipPlacement(format, size, transform), kx, ky);
  }

  /** Draws an image from the cache, where a video frame of its size would land. */
  private drawCached(
    target: CanvasRenderingContext2D,
    format: ProjectFormat,
    { source, width, height }: CachedPicture,
    transform: ClipTransform,
    kx: number,
    ky: number,
  ): void {
    land(target, source, clipPlacement(format, { width, height }, transform), kx, ky);
  }

  /** Draws one clip onto `target` at its placement: a media frame or the element's own `draw`. */
  private drawClip(
    target: CanvasRenderingContext2D,
    format: ProjectFormat,
    clip: Clip,
    path: string,
    time: Micros,
    transform: ClipTransform,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
    kx: number,
    ky: number,
  ): void {
    const picture = this.elements.get(clip.kind)?.definition.picture;
    if (!picture) return;
    if (picture.source !== "media") {
      this.drawPicture(
        target,
        picture,
        format,
        clip,
        time,
        transform,
        propsOverrides.get(clip.id),
        kx,
        ky,
      );
      return;
    }
    if (!hasMedia(clip)) return;
    const element = this.pool.elementOf(path);
    if (!(element instanceof HTMLVideoElement)) return;
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.videoWidth === 0) return;

    const size = { width: element.videoWidth, height: element.videoHeight };
    const frame = this.levels?.correct(element, size.width, size.height) ?? element;
    land(target, frame, clipPlacement(format, size, transform), kx, ky);
  }

  /** Draws an element that paints itself (text, a plugin's), at its placement. */
  private drawPicture(
    target: CanvasRenderingContext2D,
    picture: PictureDefinition<Record<string, unknown>>,
    format: ProjectFormat,
    clip: Clip,
    time: Micros,
    transform: ClipTransform,
    override: Record<string, unknown> | undefined,
    kx: number,
    ky: number,
  ): void {
    if (!picture.size || !picture.draw) return;
    const saved = this.elements.resolve(clip, format);
    const props = override ? mergeProps(saved, override) : saved;
    const measure = canvasTextMeasure(this.ctx);
    const size = picture.size(props, { format, measure });
    const placement = clipPlacement(format, size, transform, picture.fit);
    const env = {
      format,
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
    format: ProjectFormat,
    clip: Clip,
    time: Micros,
    override: Record<string, unknown> | undefined,
  ): boolean {
    const picture = this.elements.get(clip.kind)?.definition.picture;
    if (!picture?.ready) return true;
    const saved = this.elements.resolve(clip, format);
    const props = override ? mergeProps(saved, override) : saved;
    return picture.ready(props, { time: time - clip.start });
  }
}
