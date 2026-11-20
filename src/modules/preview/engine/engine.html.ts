import { microsToSeconds, type Micros } from "@/core";
import { canvasTextMeasure, mergeProps, type PictureDefinition } from "@/modules/element";
import {
  clipComposite,
  clipPlacement,
  clipTransform,
  followedClip,
  type FollowLive,
  formatOf,
  type Clip,
  dbToLinear,
  fadeLevel,
  heardDenoise,
  pitchShift,
  soundOf,
  type ClipComposite,
  type ClipMask,
  type BusId,
  type ClipId,
  type ClipPlacement,
  type ClipSound,
  type ClipTransform,
  type Composition,
  type MediaAsset,
  type MaskId,
  type MaskMapping,
  maskPlacement,
  type MediaId,
  type TrackId,
  type ProjectFormat,
  type ProjectState,
  speedOf,
  type ClipSpeed,
  elementTimeAt,
  rampOf,
  rateAt,
  sourceTimeAt,
} from "@/modules/project";
import { cappedPassSize } from "../logic/capping";
import { resolveFrame } from "../logic/frame";
import { liveMasks, usableMatte } from "../logic/masks";
import { soundGains } from "../logic/junctions";
import { mutedInPlacement, placeSound } from "../logic/mix";
import { picturesSettled } from "../logic/readiness";
import type {
  LiveSound,
  LoudnessReading,
  MixLevels,
  PictureOptions,
  PreviewEngine,
} from "../preview.types";
import { elementUrl, quietSlot, voiceSlot } from "./engine.audio";
import { PITCH_LEAD_SECONDS } from "./engine.soundchain";
import { ImageCache } from "./engine.images";
import { cutLayer, landLayer } from "./engine.composite";
import { EngineFilters } from "./engine.filters";
import { createLineLists, NO_LINES } from "./engine.line";
import { MaskPainter } from "./engine.masks";
import { MixCanvases, drawTrack } from "./engine.mix";
import { NestedCanvases } from "./engine.nested";
import { createSoundMix } from "./engine.soundmix";
import { MediaSlotPool } from "./engine.slots";
import { RAMP_RATE_STEP, syncSlot } from "./engine.sync";
import type {
  CachedPicture,
  ClipDrawer,
  EngineOptions,
  FilterSubject,
  Nesting,
  PlacementTarget,
  ResolvedFrame,
  SoundClock,
  SoundMix,
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

/** Every clip, with its filters, and nothing over the frame. */
const PLAIN: PictureOptions = { bypass: false, compare: null, viewer: [], only: null };

/** Draws a picture at its placement, mirrored by its flip. `kx` and `ky` are canvas pixels per output pixel. */
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
  target.scale(place.flipX ? -1 : 1, place.flipY ? -1 : 1);
  target.drawImage(source, -place.width / 2, -place.height / 2, place.width, place.height);
}

/** The opaque 2D context the engine draws a frame on. */
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2D canvas is not available");
  return ctx;
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
  private ctx: CanvasRenderingContext2D;
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
  /** Web Audio for every sound element; a picture-only engine has no sound. */
  private readonly sound: SoundMix;
  private readonly awaited = new Set<MediaId>();
  /** Inside `playSlice`: the loudness tap stays off. */
  private slicing = false;
  /** Levels, filters and viewer passes, on the engine's GPU runner. */
  private readonly filters: EngineFilters;
  private picture: PictureOptions = PLAIN;
  /** While drawing: whether filters run (not on the plain half of a compare, nor bypassed). */
  private filtering = true;
  /** The playhead as sound follows it, from the last `render` (one object, set in place). */
  private readonly clock: SoundClock = { time: 0, playing: false, until: Infinity };
  /** The volume lines of inner tracks, made once per placement and line. */
  private readonly lineLists = createLineLists();
  /** Masks and matte tracks; a capture or an export fails its frame when their GPU part does. */
  private readonly maskPainter: MaskPainter;

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly options: EngineOptions,
  ) {
    this.ctx = context2d(canvas);
    this.pool = new MediaSlotPool(options);
    this.images = new ImageCache(options.onFrameReady);
    this.imageFrames = options.imageFrames;
    this.ensureFont = options.ensureFont;
    this.elements = options.elements;
    this.junctions = options.junctions;
    this.mixCanvases = new MixCanvases(canvas);
    this.pictureOnly = options.pictureOnly ?? false;
    this.sound = createSoundMix(this.pictureOnly);
    this.filters = new EngineFilters(options);
    this.maskPainter = new MaskPainter({
      gpu: options.gpu,
      strict: (options.filterTarget ?? "preview") !== "preview",
      onFailure: (error) => options.maskFailed?.(error),
    });
  }

  setPicture(options: PictureOptions): void {
    this.picture = options;
    this.filters.captureOptions = options.filters;
  }

  setCanvas(canvas: HTMLCanvasElement): void {
    if (canvas === this.canvas) return;
    this.ctx = context2d(canvas);
    this.canvas = canvas;
    this.mixCanvases.setMain(canvas);
  }

  render(
    project: ProjectState,
    composition: Composition,
    time: Micros,
    playing: boolean,
    transforms: ReadonlyMap<ClipId, ClipTransform> = new Map(),
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>> = new Map(),
    until: Micros = Infinity,
  ): void {
    this.sound.update(project, composition);
    this.clock.time = time;
    this.clock.playing = playing;
    this.clock.until = Math.min(until, composition.duration);
    this.sound.follow(time, playing, this.clock.until);
    // A scrub slice is heard and metered as playback is, but never reaches the loudness reading.
    this.sound.setPlaying(playing && !this.slicing);
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
    this.maskPainter.release(placements);

    this.settled = true;
    this.prepare(project, frame, playing, propsOverrides, 1, false, null);

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
      const denoise =
        track.kind === "audio" ? this.denoiseOf(project, composition, path) : undefined;
      const url = elementUrl(this.options, clip.mediaId, speedOf(clip), denoise);
      if (url === null) continue;
      const seconds = microsToSeconds(this.elementTime(clip, at));
      const slot = this.pool.acquire(path, clip, track.kind, seconds, url);
      if (!slot) continue;
      quietSlot(slot, track, this.sound.graph);
      syncSlot(slot, seconds, false);
    }

    // Slots that lost their clip this frame must go quiet.
    this.pool.pauseIdle();

    // Only paint complete frames: a layer still decoding would flash black. Keep the previous
    // picture instead; the controller retries until every layer has its frame.
    if (this.settled) this.draw(project, frame, transforms, propsOverrides);
  }

  playSlice(
    project: ProjectState,
    composition: Composition,
    time: Micros,
    start: boolean,
    transforms?: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides?: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): void {
    this.slicing = true;
    try {
      // Paused first, so every element seeks exactly there: a playing one would aim ahead of it.
      if (start) this.render(project, composition, time, false, transforms, propsOverrides);
      this.render(project, composition, time, true, transforms, propsOverrides);
    } finally {
      this.slicing = false;
    }
  }

  setSound = (live: LiveSound): void => this.sound.setSound(live);
  levels = (): MixLevels => this.sound.levels();
  reduction = (target: TrackId | BusId | "master"): number => this.sound.reduction(target);
  spectrum = (into: Float32Array<ArrayBuffer>): number => this.sound.spectrum(into);
  loudness = (): LoudnessReading | null => this.sound.loudness();
  resetLoudness = (): void => this.sound.resetLoudness();

  /**
   * The noise reduction a clip at `path` is heard through: that of the top-level track its path
   * starts on (a placement's clips sound through the outer track), by `heardDenoise`.
   */
  private denoiseOf(project: ProjectState, composition: Composition, path: string) {
    const top = project.clips[path.split("/")[0]!];
    const track = top && project.tracks[top.trackId];
    return track?.kind === "audio" ? heardDenoise(track, composition) : undefined;
  }

  /** Redraws once a reversed copy is ready. */
  private awaitReversed(mediaId: MediaId): void {
    if (this.awaited.has(mediaId)) return;
    this.awaited.add(mediaId);
    this.options.whenReversed?.(mediaId, () => {
      this.awaited.delete(mediaId);
      this.options.onFrameReady();
    });
  }

  /** Where a clip's element should be at a time. */
  private elementTime(clip: Clip & { mediaId: MediaId }, time: Micros): Micros {
    return elementTimeAt(clip, time, this.options.fileDuration?.(clip.mediaId) ?? 0);
  }

  /**
   * Gets every element of a frame in place, at any depth, and checks what can be painted. `gain`,
   * `silenced` and `nesting` come from the tracks around a placement.
   */
  private prepare(
    project: ProjectState,
    { composition, time, tracks, mattes }: ResolvedFrame,
    playing: boolean,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
    gain: number,
    silenced: boolean,
    nesting: Nesting | null,
  ): void {
    // Sound clips crossfading under a junction (junction rule 4); fadeLevel folds them in.
    const gains = soundGains(project, composition, time);
    // A filter still loading holds the frame, as an undecoded video does.
    const filtering = !this.picture.bypass;
    if (filtering && !this.filters.frameReady(composition, project)) this.settled = false;
    for (const { track, clips } of tracks) {
      // Inside a placement, an inner group's mute silences its tracks as their own mute does;
      // top-level, the group's bus does it.
      const quiet = silenced || (nesting !== null && mutedInPlacement(composition, track));
      // During a junction's overlap both clips are here, each on its own element (one per path),
      // and both frames must be ready before anything is painted.
      // A matte track draws (as a matte) even when hidden, so its frames are waited for too.
      const visible = !track.hidden || mattes.has(track.id);
      for (const { clip, path, inner } of clips) {
        const shown = track.kind === "video" && visible;
        const filtered = inner !== undefined || hasMedia(clip);
        if (shown && filtered && filtering && !this.filters.clipReady({ clip, project })) {
          this.settled = false;
        }
        const sound = (propsOverrides.get(clip.id)?.sound as ClipSound) ?? soundOf(clip);
        const own =
          track.kind === "audio"
            ? gain * fadeLevel(sound, clip, time, gains.get(clip.id)) * dbToLinear(sound.volumeDb)
            : gain;
        // Inside a placement, an inner track's line joins those above, on its composition's clock.
        const lines = nesting
          ? this.lineLists.inside(nesting.lines, track.mix?.volumeLine, time - nesting.playhead)
          : NO_LINES;
        // Inside a placement, the clips get the noise reduction of the track it sits on.
        const trackDenoise = track.kind === "audio" ? heardDenoise(track, composition) : undefined;
        const denoise = nesting ? nesting.denoise : trackDenoise;
        if (inner) {
          const { bus, gain: through, pan } = placeSound(composition, track, nesting, own, 0);
          const around = { bus, pan, denoise, lines, playhead: nesting?.playhead ?? time };
          const within = quiet || track.muted;
          this.prepare(project, inner, playing, propsOverrides, through, within, around);
          continue;
        }
        if (!hasMedia(clip)) continue; // drawn from the document, no media element
        const media = project.media[clip.mediaId];
        if (!media) continue;
        if (media.kind === "image") {
          // Never a pooled element: the picture comes from the cache, at the clip's own time.
          const current = this.wantImage(media, time - clip.start);
          if (visible && !this.images.ready(current)) this.settled = false;
          continue;
        }
        // A ramp plays as keyed: a speed drag doesn't reach it, and its rate is the one now.
        const ramped = rampOf(clip) !== undefined;
        const override = ramped ? undefined : (propsOverrides.get(clip.id)?.speed as ClipSpeed);
        const speed = override ?? speedOf(clip);
        const rate = ramped ? rateAt(clip, time) : speed.rate;
        const heardFrom = track.kind === "audio" ? denoise : undefined;
        const url = elementUrl(this.options, clip.mediaId, speed, heardFrom);
        if (url === null) {
          // Its reversed copy is on the way: the rest of the frame doesn't wait for it.
          this.awaitReversed(clip.mediaId);
          continue;
        }
        const desired = microsToSeconds(this.elementTime({ ...clip, speed }, time));
        // The track decides the element: pictures come from video tracks (always silent), sound
        // from audio tracks (a video file's sound plays through an <audio> on the same URL).
        const slot = this.pool.acquire(path, clip, track.kind, desired, url);
        if (!slot) continue;
        // A copy can differ from the file by a frame, so its own length is the mirror.
        const { duration: copyLength } = slot.element;
        const exact =
          speed.reversed && Number.isFinite(copyLength)
            ? copyLength - microsToSeconds(sourceTimeAt({ ...clip, speed }, time))
            : desired;
        // The pitch of a ramp follows its rate now, in steps, since each rate keeps its own sound.
        const heardRate = ramped ? Math.round(rate / RAMP_RATE_STEP) * RAMP_RATE_STEP : rate;
        const heard = this.sound.heard(sound, { ...speed, rate: heardRate });
        const placed = placeSound(composition, track, nesting, own, heard.pan);
        const voice = { ...placed, lines, silenced: quiet, sound: heard, name: media.name };
        const heardVoice = track.kind === "audio" ? voice : null;
        voiceSlot(slot, track, heardVoice, this.sound.graph, this.clock);
        const pitched = playing && track.kind === "audio" && pitchShift(heard) !== 0;
        const lead = pitched ? PITCH_LEAD_SECONDS * rate : 0;
        syncSlot(slot, exact + lead, playing && rate > 0, rate, ramped);
        if (slot.kind === "video" && visible && !this.pool.hasFrame(slot)) {
          this.settled = false;
        }
      }
    }
    const pictures = tracks
      .filter(({ track }) => track.kind === "video")
      .flatMap(({ track, clips }) =>
        clips
          .filter(({ clip, inner }) => !hasMedia(clip) && !inner)
          .map(({ clip }) => ({ clip, hidden: track.hidden && !mattes.has(track.id) })),
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
    this.sound.setPlaying(false);
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
    this.sound.dispose();
    this.images.dispose();
    this.mixCanvases.dispose();
    this.nested.dispose();
    this.maskPainter.dispose();
    this.options.gpu?.dispose();
    this.filters.dispose();
  }

  private draw(
    project: ProjectState,
    frame: ResolvedFrame,
    transforms: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): void {
    const { ctx, canvas } = this;
    const { bypass, compare, viewer } = this.picture;
    this.paintFrame(project, frame, transforms, propsOverrides, !bypass);
    if (compare !== null && !bypass) {
      // The same frame without filters, left of the wipe.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.rect(0, 0, Math.round(compare * canvas.width), canvas.height);
      ctx.clip();
      this.paintFrame(project, frame, transforms, propsOverrides, false);
      ctx.restore();
    }
    this.filters.over(ctx, viewer);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.options.onDrawn?.();
  }

  /** The whole frame on the canvas, over its background, with or without filters. */
  private paintFrame(
    project: ProjectState,
    frame: ResolvedFrame,
    transforms: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
    filtering: boolean,
  ): void {
    const { ctx, canvas } = this;
    this.filtering = filtering;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = frame.composition.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.drawFrame(ctx, this.mixCanvases, project, frame, "", transforms, propsOverrides);
    if (!filtering) return;
    const { composition, time } = frame;
    const size = { width: canvas.width, height: canvas.height };
    this.filters.over(ctx, this.filters.forFrame(composition, project, "", size, time));
  }

  /** Draws a frame's pictures onto `target`, which is sized like its composition's format. */
  private drawFrame(
    target: CanvasRenderingContext2D,
    mix: MixCanvases,
    project: ProjectState,
    { composition, time, tracks, mattes }: ResolvedFrame,
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
    /** Paints a clip; where its mask space sits, or null when nothing was drawn. */
    const paint = (on: CanvasRenderingContext2D, clip: Clip): MaskMapping | null => {
      // A live edit (a slider being dragged) is in the clip's own terms: placed through its path again.
      const live = propsOverrides.get(clip.id) as FollowLive | undefined;
      const saved = project.clips[clip.id];
      const placed = live && saved ? followedClip(saved, time, project.paths, live) : clip;
      const transform = transforms.get(clip.id) ?? clipTransform(placed);
      const subject = { clip, project, path: pathOf(clip), time };
      const box = { on, format, kx, ky };
      const inner = inners.get(clip.id);
      if (inner) return this.drawPlacement(box, subject, inner, transform);
      const media = clip.mediaId ? project.media[clip.mediaId] : undefined;
      if (media?.kind === "image") {
        const [url] = this.imageFrames(media.id, time - clip.start, 0);
        const picture = url ? this.images.picture(url) : undefined;
        return picture ? this.drawCached(box, subject, picture, transform) : null;
      }
      return this.drawClip(box, subject, transform, propsOverrides);
    };
    // One clip alone (a capture's `only`): its own picture, so no other top-level clip, no
    // junction mix (which would pull in the clip beside it), no mask and no matte, at Normal with
    // its opacity.
    const only = prefix === "" ? this.picture.only : null;
    const matteCanvases = new Map<TrackId, HTMLCanvasElement>();
    // `blend` is false under a junction: the picture has no backdrop there (see `drawTrack`).
    // `matted` is false on a matte track, whose clips' own mattes are ignored (no chains).
    const drawWith =
      (matted: boolean): ClipDrawer =>
      (on, clip, blend = true) => {
        const live = propsOverrides.get(clip.id);
        const composite = clipComposite(clip, live?.composite as Partial<ClipComposite>);
        const mode = blend ? composite.mode : "normal";
        const liveShapes = live?.masks as Record<MaskId, Partial<ClipMask>> | undefined;
        const masks = only === null ? liveMasks(clip, liveShapes) : [];
        const matteTrack = matted && only === null ? usableMatte(clip, mattes) : null;
        const matte = matteTrack ? matteCanvases.get(matteTrack) : undefined;
        if (mode === "normal" && composite.opacity === 1 && masks.length === 0 && !matte) {
          paint(on, clip);
          return;
        }
        const layer = mix.layer();
        const mapping = paint(layer, clip);
        const alpha = mapping && this.maskPainter.masks(layer.canvas, masks, mapping, kx, ky);
        if (alpha) cutLayer(layer, alpha, "destination-in");
        if (matte && clip.matte) {
          const { canvas, op } = this.maskPainter.matte(matte, clip.matte);
          cutLayer(layer, canvas, op);
        }
        landLayer(on, layer.canvas, { mode, opacity: composite.opacity });
      };
    const drawClip = drawWith(true);

    // Matte tracks first, each into its own canvas (never a `MixCanvases` slot, which a junction
    // being mixed may hold), drawn as any track but with its clips' own mattes ignored.
    if (only === null) {
      for (const { track, clips } of tracks) {
        if (!mattes.has(track.id)) continue;
        const ctx = this.maskPainter.track(prefix, track.id, target.canvas);
        const shown = clips.map(({ clip }) => clip);
        const frame = { project, format, track, clips: shown, time };
        drawTrack(ctx, frame, mix, this.junctions, drawWith(false));
        matteCanvases.set(track.id, ctx.canvas);
      }
    }
    // Tracks are top → bottom; draw bottom first so higher tracks end up on top.
    for (let i = tracks.length - 1; i >= 0; i--) {
      const { track, clips } = tracks[i]!;
      if (track.kind !== "video" || track.hidden) continue;
      if (only !== null) {
        const alone = clips.find(({ clip }) => clip.id === only);
        if (alone) drawClip(target, alone.clip, false);
        continue;
      }
      if (mattes.has(track.id)) continue;
      const shown = clips.map(({ clip }) => clip);
      drawTrack(
        target,
        { project, format, track, clips: shown, time },
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
    subject: FilterSubject,
    inner: ResolvedFrame,
    transform: ClipTransform,
  ): MaskMapping {
    const { project, path } = subject;
    const size = inner.composition.format;
    // No sharper than the preview itself: a 4K composition in a small window stays cheap.
    const limit = Math.max(this.canvas.width, this.canvas.height);
    const ratio = Math.min(1, limit / Math.max(size.width, size.height));
    const width = Math.max(1, Math.round(size.width * ratio));
    const height = Math.max(1, Math.round(size.height * ratio));
    const nested = this.nested.take(path, width, height);
    this.drawFrame(nested.ctx, nested.mix, project, inner, path, NOTHING, NOTHING);
    const place = clipPlacement(format, size, transform);
    let picture: CanvasImageSource = nested.ctx.canvas;
    if (this.filtering) {
      // Its composition's frame filters, then the clip's own, in one run.
      const full = { width, height };
      const passSize = this.options.capPasses ? cappedPassSize(full, place, kx, ky) : full;
      const { composition, time } = inner;
      const groups = [
        ...this.filters.forFrame(composition, project, path, passSize, time),
        ...this.filters.forClip(subject, passSize),
      ];
      picture = this.filters.picture(nested.ctx.canvas, full, passSize, groups);
    }
    land(on, picture, place, kx, ky);
    return maskPlacement(format, size, transform);
  }

  /** Draws an image from the cache, where a video frame of its size would land. */
  private drawCached(
    { on, format, kx, ky }: PlacementTarget,
    subject: FilterSubject,
    { source, width, height }: CachedPicture,
    transform: ClipTransform,
  ): MaskMapping {
    const size = { width, height };
    const place = clipPlacement(format, size, transform);
    let picture: CanvasImageSource = source;
    if (this.filtering) {
      const passSize = this.options.capPasses ? cappedPassSize(size, place, kx, ky) : size;
      const groups = this.filters.forClip(subject, passSize);
      picture = this.filters.picture(source, size, passSize, groups);
    }
    land(on, picture, place, kx, ky);
    return maskPlacement(format, size, transform);
  }

  /** Draws one clip onto `target` at its placement: a media frame or the element's own `draw`. */
  private drawClip(
    { on: target, format, kx, ky }: PlacementTarget,
    subject: FilterSubject,
    transform: ClipTransform,
    propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): MaskMapping | null {
    const { clip, path, time } = subject;
    const picture = this.elements.get(clip.kind)?.definition.picture;
    if (!picture) return null;
    if (picture.source !== "media") {
      return this.drawPicture(
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
    }
    if (!hasMedia(clip)) return null;
    const element = this.pool.elementOf(path);
    if (!(element instanceof HTMLVideoElement)) return null;
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || element.videoWidth === 0) {
      return null;
    }

    const size = { width: element.videoWidth, height: element.videoHeight };
    const place = clipPlacement(format, size, transform);
    const passSize = this.options.capPasses ? cappedPassSize(size, place, kx, ky) : size;
    const groups = this.filtering ? this.filters.forClip(subject, passSize) : [];
    land(target, this.filters.video(element, clip.mediaId, size, passSize, groups), place, kx, ky);
    return maskPlacement(format, size, transform);
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
  ): MaskMapping | null {
    if (!picture.size || !picture.draw) return null;
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
    return maskPlacement(format, size, transform);
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
