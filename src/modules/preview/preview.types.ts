import type { ActorId, Micros } from "@/core";
import type { ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { FontRequest } from "@/modules/fonts";
import type { FilterSet } from "./engine/engine.types";
import type { GpuPass } from "./gpu/gpu.types";
import type {
  Clip,
  ClipId,
  ClipTransform,
  Composition,
  CompositionId,
  Junction,
  MediaId,
  ProjectState,
  SoundEffect,
  TrackId,
  TrackMix,
} from "@/modules/project";

/** Called on every frame while playing, and once per seek while paused. */
export type TimeListener = (time: Micros) => void;

/** A stretch of the timeline that playback repeats: reaching `to` goes back to `from`. */
export interface LoopRange {
  from: Micros;
  to: Micros;
}

/** Where a composition's playhead was left, kept for when it's opened again. */
export interface PlayheadPlace {
  time: Micros;
  loop: LoopRange | null;
}

/**
 * The single source of truth for the playhead. Driven by `requestAnimationFrame`, never by
 * React state, so playback causes no re-renders.
 */
export interface PlaybackClock {
  /** Current playhead time. */
  getTime(): Micros;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  /** Moves the playhead (clamped to `[0, duration]`). */
  seek(time: Micros): void;
  /** Subscribes to time updates. The listener is called immediately with the current time. */
  onTime(listener: TimeListener): () => void;
  /** Subscribes to play/pause changes. Compatible with `useSyncExternalStore`. */
  onPlayingChange(listener: () => void): () => void;
  /** The loop region, or null. View state: never in the project or history. */
  getLoop(): LoopRange | null;
  /**
   * Sets the loop region, or clears it (null). The ends are put in order and clamped to the
   * composition; a range shorter than one frame is refused: returns false and nothing changes.
   * While playing, crossing `to` goes back to `from`; playing from past `to` plays on.
   */
  setLoop(range: LoopRange | null): boolean;
  /** Subscribes to loop changes. Compatible with `useSyncExternalStore`. */
  onLoopChange(listener: () => void): () => void;
  dispose(): void;
}

/**
 * Renders the timeline at a given time. Swappable: v1 uses HTML media elements and a 2D canvas
 * (`HtmlMediaEngine`); a native or WebCodecs engine can implement the same contract later.
 */
export interface PreviewEngine {
  /**
   * Draws (and, while playing, keeps media in sync with) the project at `time`. `transforms`
   * replaces clips' saved transforms while a gesture is in progress.
   */
  render(
    project: ProjectState,
    composition: Composition,
    time: Micros,
    playing: boolean,
    transforms?: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides?: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): void;
  /**
   * Plays a short slice of sound at `time` (audio scrub) through the sound graph, so it is mixed
   * and metered like playback; the loudness reading doesn't count it. `start` seeks every element
   * exactly there first (a slice beginning); without it, the slice goes on and its frame is drawn
   * once decoded. `pauseAll` ends it.
   */
  playSlice(
    project: ProjectState,
    composition: Composition,
    time: Micros,
    start: boolean,
    transforms?: ReadonlyMap<ClipId, ClipTransform>,
    propsOverrides?: ReadonlyMap<ClipId, Record<string, unknown>>,
  ): void;
  /** Stops all media without forgetting state (e.g. on pause). */
  pauseAll(): void;
  /**
   * Draws on another canvas from the next frame on. Media elements, images and the sound graph
   * stay as they are, so what plays goes on without a gap.
   */
  setCanvas(canvas: HTMLCanvasElement): void;
  /**
   * How pictures are drawn from the next render on: filters bypassed, the compare wipe, the
   * viewer's passes, one clip alone. Captures and renderers set only `bypass` and `only`.
   */
  setPicture(options: PictureOptions): void;
  /** Whether every visible layer has its frame for the last rendered time. */
  isSettled(): boolean;
  /** The canvas as a base64 PNG (no `data:` prefix). */
  captureFrame(): Promise<string>;
  /** The canvas as RGBA bytes, row by row from the top. */
  readPixels(): Uint8ClampedArray;
  /** What the user hears beside the document; applied at once, not on the next frame. */
  setSound(sound: LiveSound): void;
  /** Peaks of each track bus and the master now; silence when nothing went through the graph. */
  levels(): MixLevels;
  /**
   * Loudness of the master, measured while playing, since the last reset; null while it isn't
   * measured. Paused, the last reading stands.
   */
  loudness(): LoudnessReading | null;
  /** Starts the loudness measurement over. */
  resetLoudness(): void;
  dispose(): void;
}

/** How the user listens: never in the document, never in an export. */
export interface MonitorState {
  /** Left and right summed to both speakers. */
  mono: boolean;
  /** 20 dB down. */
  dim: boolean;
  /** Speaker volume in dB. */
  speakerDb: number;
}

/** The peak of each side, in dBFS; `-Infinity` for silence. */
export interface StereoLevel {
  left: number;
  right: number;
}

/** Peaks of the open composition's audio tracks and of its master. */
export interface MixLevels {
  tracks: Record<TrackId, StereoLevel>;
  master: StereoLevel;
}

/**
 * What a compressor, gate or duck carries from one sample to the next (`logic/dynamics.ts`): the
 * detector's envelope, linear. Starts at 0.
 */
export interface DynamicsState {
  envelope: number;
}

/**
 * A detector and gain curve worked out once from an effect's settings (`compressorCurve`,
 * `gateCurve`, `duckCurve`), as FFmpeg's `config_input` does: levels in natural logs, a soft knee
 * from `kneeStart` to `kneeStop`, coefficients of the one-pole detector.
 */
export interface DynamicsCurve {
  /** `compress` lowers what is over the threshold; `expand` lowers what is under it (a gate). */
  mode: "compress" | "expand";
  attack: number;
  release: number;
  ratio: number;
  /** The knee, linear (1 is none). */
  knee: number;
  thres: number;
  kneeStart: number;
  kneeStop: number;
  linKneeStart: number;
  linKneeStop: number;
  /** Where the curve meets the knee's far end: FFmpeg's compressed knee stop, or the gate's knee start. */
  kneeTarget: number;
  /** The gate's floor, linear (0 for none). */
  range: number;
  makeup: number;
  /** How much of the processed sound is heard, 0 to 1; the rest is dry. */
  mix: number;
}

/** What one channel of the de-esser carries from one sample to the next (`logic/deesser.ts`). */
export interface DeesserState {
  s1: number;
  s2: number;
  s3: number;
  m1: number;
  m2: number;
  ratioA: number;
  ratioB: number;
  iirSampleA: number;
  iirSampleB: number;
  flip: boolean;
}

/** FFmpeg `deesser`'s coefficients, worked out once from the effect's settings. */
export interface DeesserSettings {
  intensity: number;
  maxdess: number;
  iirAmount: number;
}

/** FFmpeg `alimiter`'s settings, worked out once: the limit, linear, and the release in samples. */
export interface LimiterSettings {
  limit: number;
  releaseSamples: number;
}

/**
 * What the limiter (`logic/limiter.ts`) carries: the lookahead buffer of interleaved frames and
 * FFmpeg's schedule of gain changes. Allocated once; the step allocates nothing.
 */
export interface LimiterState {
  channels: number;
  /** The lookahead in interleaved samples (frames × channels). */
  size: number;
  buffer: Float64Array;
  nextpos: Int32Array;
  nextdelta: Float64Array;
  pos: number;
  att: number;
  delta: number;
  nextiter: number;
  nextlen: number;
}

/**
 * What the dynamics worklet is told: run this effect (any kind it knows) with these settings. A
 * new message replaces the settings; the processor keeps its state.
 */
export type DynamicsCommand = Exclude<SoundEffect, { kind: "eq" } | { kind: "denoise" }>;

/** One dynamics effect on stereo blocks (`createEffectRunner`), what the dynamics worklet runs. */
export interface EffectRunner {
  /** New settings (or a first effect); the state carries on. */
  set(command: DynamicsCommand): void;
  /**
   * One block: the sound in, the key (a duck's listened tracks; read only by `duck`), and the
   * output, as long as the block.
   */
  process(
    left: Float32Array,
    right: Float32Array,
    keyLeft: Float32Array,
    keyRight: Float32Array,
    outLeft: Float32Array,
    outRight: Float32Array,
  ): void;
}

/** Loudness of the master, as BS.1770 measures it. */
export interface LoudnessReading {
  /** LUFS over the last 400 ms. */
  momentary: number;
  /** LUFS over the last 3 s. */
  shortTerm: number;
  /** LUFS over all the playing since the last reset, gated. */
  integrated: number;
  /** Loudness range in LU. */
  range: number;
  /** dBTP: the largest true peak since the last reset (a maximum, it never falls back). */
  truePeak: number;
}

/** A BS.1770 meter for a stereo signal (`createLoudnessMeter`). */
export interface LoudnessMeter {
  /** Takes the next samples of both sides (equal lengths, any size). */
  push(left: Float32Array, right: Float32Array): void;
  /** Everything measured since the start or the last `reset`; `-Infinity` until a window fills. */
  read(): LoudnessReading;
  /** Starts the measurement over. */
  reset(): void;
}

/** The coefficients of a biquad, with `a0` taken as 1. */
export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** Gated blocks counted by loudness (`createHistogram`), in memory that doesn't grow. */
export interface LoudnessHistogram {
  /** Counts a block of this mean-square energy; below the absolute gate it's dropped. */
  add(energy: number): void;
  /** The mean energy of the blocks above a gate `relative` LU under their own mean; 0 with none. */
  gatedEnergy(relative: number): number;
  /** The loudness below which each fraction (0..1) of the blocks above that gate lies. */
  percentiles(fractions: number[], relative: number): number[];
  reset(): void;
}

/**
 * What the loudness worklet is told: start over with readings carrying `reset`, or measure only
 * while `active` (playing). Inactive, it neither measures nor posts, so its last reading stands.
 */
export type LoudnessCommand = { reset: number } | { active: boolean };

/** What the loudness worklet posts every 100 ms while active. */
export interface LoudnessMessage {
  /** The reset it has seen, so a reading from before a reset is ignored. */
  generation: number;
  reading: LoudnessReading;
}

/** What the user hears beside the document: live drag values, solo and the monitor. */
export interface LiveSound {
  /** Live values of tracks and the master (`"master"`), drawn over the saved ones. */
  mix: ReadonlyMap<TrackId | "master", Partial<TrackMix>>;
  /** Tracks soloed; none means every track sounds. */
  solo: TrackId[];
  monitor: MonitorState;
}

/** What the user hears in the preview, beside the document. Ephemeral: never in history. */
export interface PreviewSound {
  /**
   * Plays a track (or the master) with this live patch of its mix, without changing the project
   * (feedback while a fader or pan is dragged). Pass null to go back to the saved mix. The edit
   * commits with `sound.setTrackMix` or `sound.setMaster`.
   */
  previewMix(target: TrackId | "master", patch: Partial<TrackMix> | null): void;
  /** How the user listens: mono, dim and speaker volume. */
  setMonitor(state: MonitorState): void;
  /** Silences every other track's bus; an empty list lets every track sound. */
  setSolo(trackIds: TrackId[]): void;
  /** Peaks now, of each track bus and the master. Read it per frame; it holds no peaks. */
  levels(): MixLevels;
  /**
   * Loudness of the master, measured while playing, since the last reset; null while it isn't
   * measured. Paused, the last reading stands.
   */
  loudness(): LoudnessReading | null;
  /** Starts the loudness measurement over. */
  resetLoudness(): void;
}

/** What the preview controller needs from the rest of the app. Injected so it can be tested. */
export interface PreviewControllerDeps {
  clock: PlaybackClock;
  getProject(): ProjectState;
  /** The composition `actor` has open (the user's by default). */
  getComposition(actor?: ActorId): Composition | null;
  /** Length of the composition `actor` has open (the user's by default). */
  getDuration(actor?: ActorId): Micros;
  /** Called on every project change. Returns an unsubscribe function. */
  subscribeProject(listener: () => void): () => void;
  /** Called on every media metadata change (e.g. a proxy became ready). */
  subscribeMedia(listener: () => void): () => void;
  /** The live engine: `onFrameReady` when a frame decodes while paused, `onDrawn` after each draw. */
  createEngine(
    canvas: HTMLCanvasElement,
    onFrameReady: () => void,
    onDrawn: () => void,
  ): PreviewEngine;
  /** `requestAnimationFrame` in the app; a manual queue in tests. */
  requestFrame(callback: () => void): void;
  capture: PreviewCapture;
  createRenderer(options: FrameRendererOptions): FrameRenderer;
  /** This webview's video levels, measured once per kernel (`PreviewApi.videoLevels`). */
  videoLevels(): Promise<VideoLevels | null>;
  /** Whether the GPU can be used (`PreviewApi.gpuAvailable`). */
  gpuAvailable(): boolean;
}

/** What offscreen capture needs from the rest of the app. */
export interface PreviewCaptureDeps {
  getProject(): ProjectState;
  getComposition(id: CompositionId): Composition | null;
  /** Whether a font can be drawn now; when not, it starts loading. */
  ensureFont(request: FontRequest): boolean;
  /** Resolves once the first measure of video levels has ended, either way (no retry). */
  levelsSettled(): Promise<void>;
  /**
   * A picture-only engine that asks `ensureFont` about fonts. `target` is what filters are told
   * (and both fail a frame when a filter does).
   */
  createEngine(
    canvas: HTMLCanvasElement,
    ensureFont: (request: FontRequest) => boolean,
    target: "capture" | "export",
    options?: Pick<FrameRendererOptions, "mediaUrl" | "reversedUrl">,
  ): PreviewEngine;
}

/** What a webview's canvas holds for video black and white (0–255). */
export interface VideoLevels {
  black: number;
  white: number;
}

/** How this webview draws video levels, measured once per kernel on `media`'s levels clip. */
export interface VideoLevelsMeter {
  /** The levels to correct, once measured; null before, when no correcting is needed, or failed. */
  current(): VideoLevels | null;
  /**
   * Measures (once; later calls share it). Null when video draws right. Rejects when it couldn't
   * be measured, and asking again tries again.
   */
  measure(): Promise<VideoLevels | null>;
  /**
   * Resolves once the first measure has ended, either way (starting it if none has), and never
   * measures again: what a frame waits for, so a failing measure isn't retried at every frame.
   */
  settled(): Promise<void>;
}

/** What a hidden renderer draws. */
export interface FrameRendererOptions {
  /** The document to draw: a snapshot, so later edits don't reach it. */
  project: ProjectState;
  compositionId: CompositionId;
  /** Where the pictures come from, when not from the files the preview plays. */
  mediaUrl?(id: MediaId): string;
  /** Where reversed clips come from, when not from the preview's copies. */
  reversedUrl?(id: MediaId): string | null;
}

/** Draws frames of one composition at its full size, on an engine of its own. */
export interface FrameRenderer {
  /** RGBA bytes of the frame at `time`, once every layer has decoded. Rejects if one never does. */
  frameAt(time: Micros): Promise<Uint8ClampedArray>;
  /** Releases the decoders. */
  dispose(): void;
}

/** What audio scrub needs from the controller. */
export interface ScrubDeps extends Pick<
  PreviewControllerDeps,
  "clock" | "getComposition" | "getProject"
> {
  /** The engine attached now, if any. */
  engine(): PreviewEngine | null;
  /** Live gestures, drawn by a slice as by a render. */
  transforms: ReadonlyMap<ClipId, ClipTransform>;
  propsOverrides: ReadonlyMap<ClipId, Record<string, unknown>>;
  /** Draws the paused frame again (after the last slice). */
  redraw(): void;
}

/** Audio scrub of one controller (`preview.scrub.ts`). */
export interface Scrubber {
  scrub(time: Micros): void;
  /** Silences scrub until the returned release is called (several holds may overlap). */
  hold(): () => void;
  /** Whether a slice is playing. */
  scrubbing(): boolean;
  /**
   * For a redraw: while a slice plays, plays on where it has got to and returns true (the
   * redraw is done); otherwise false. Playing drops the slice.
   */
  drawSlice(): boolean;
  onChange(listener: () => void): () => void;
  dispose(): void;
}

/** Offscreen capture, owned by the preview controller. */
export interface PreviewCapture {
  captureAt(time: Micros, compositionId: CompositionId, options?: CaptureOptions): Promise<string>;
  dispose(): void;
}

/** The preview module's API for one kernel. */
export interface PreviewApi {
  /** The playhead. The timeline and the preview both follow it. */
  readonly playback: PlaybackClock;
  /**
   * The playhead of an actor: `playback` for the local user; anyone else gets their own, starting
   * where the user is, that nothing follows. Commands use this so an agent never moves the user.
   */
  clockFor(actor: ActorId): PlaybackClock;
  /** Forgets a collaborator's playhead. */
  dropClock(actor: ActorId): void;
  /**
   * Audio scrub: plays 80 ms of sound from `time` through the mix, as playback would sound there.
   * Calls during a slice wait for it, and only the latest plays next, so a fast drag never piles
   * slices up. Does nothing while playing. The user's preview only (an agent's clock plays
   * nothing).
   */
  scrub(time: Micros): void;
  /**
   * Silences audio scrub until the returned release is called: `scrub` does nothing meanwhile (a
   * slice under way is cut). The Sound page holds it while a take records, so the open microphone
   * never hears the speakers scrub. Holds may overlap.
   */
  holdScrub(): () => void;
  /** Whether a scrub slice is playing. */
  isScrubbing(): boolean;
  /** Subscribes to a scrub starting or ending. Compatible with `useSyncExternalStore`. */
  onScrubbingChange(listener: () => void): () => void;
  /**
   * Attaches a preview canvas. Returns a detach function. Only the newest attached canvas is drawn
   * on (a page's own stage over the editor's); when it detaches, the one under it is drawn on again.
   */
  attachCanvas(canvas: HTMLCanvasElement): () => void;
  /** Redraws on the next frame (e.g. after the canvas was resized). */
  redraw(): void;
  /**
   * The timeline at `time` as a base64 PNG at the project's size, filters applied (never the
   * viewer's bypass, compare or passes). Doesn't touch the user's preview and works with the window
   * hidden. Rejects if a frame isn't decoded within 3 s, or with a filter's message when one fails.
   * `options` leave the filters out or draw one clip alone (a clip's own picture, for pickers and
   * matching).
   */
  captureAt(time: Micros, compositionId: CompositionId, options?: CaptureOptions): Promise<string>;
  /**
   * A renderer of its own for going through a composition frame by frame, the way the preview
   * draws it. Doesn't touch the user's preview. Dispose it when done.
   */
  createRenderer(options: FrameRendererOptions): FrameRenderer;
  /**
   * How this webview draws video to a canvas, measured once per kernel on a clip whose left half
   * is video black and right half video white. Some webviews squeeze the range (WebKitGTK: black at
   * 16); the preview, captures and renderers then correct every video layer on the GPU. Null when
   * video draws right. Rejects when it couldn't be measured; asking again tries again.
   */
  videoLevels(): Promise<VideoLevels | null>;
  /**
   * Whether this system can draw on the GPU (WebGL2), asked once per kernel. Pictures are graded
   * on the GPU, so the Tint page needs it.
   */
  gpuAvailable(): boolean;
  /**
   * Draws a clip with `transform` instead of its saved one, without changing the project (live
   * feedback while dragging on the canvas). Pass null to go back to the saved transform. The
   * gesture commits with `element.setProps` (a `transform` patch) on release.
   */
  previewTransform(clipId: ClipId, transform: ClipTransform | null): void;
  /**
   * Draws a clip with this live patch of its values (any element: text, a plugin's) merged over
   * the saved ones, without changing the project (feedback while a slider is dragged or words are
   * typed). Pass null to go back to the saved values. The edit commits with `element.setProps`.
   */
  previewProps(clipId: ClipId, patch: Record<string, unknown> | null): void;
  /** Calls `listener` with the clip id whenever a live patch is set or cleared. Returns the unsubscribe. */
  onPropsOverride(listener: (clipId: ClipId) => void): () => void;
  /** The live patch of a clip, so the canvas tools measure the picture being drawn. */
  propsOverride(clipId: ClipId): Record<string, unknown> | undefined;
  /** Zoom and pan of the viewer. View state only: not in the project, not undoable. */
  readonly viewport: ViewportApi;
  /** What the user hears: live mix values, solo, the monitor and the meters. Ephemeral. */
  readonly sound: PreviewSound;
  /** How the live preview shows pictures: bypass, compare, viewer passes, frame reads. Ephemeral. */
  readonly picture: PreviewPictureApi;
}

/** Zoom and pan of the preview viewer. */
export interface ViewportState {
  /** Size relative to "fit in the panel": 1 fits, 2 is twice as big. */
  zoom: number;
  /** Offset of the frame from the panel's center, in screen pixels. */
  panX: number;
  panY: number;
}

/** The viewer's zoom and pan, and the ways to change them. */
export interface ViewportApi {
  /** Read with `useStore(viewport.store, selector)` or subscribe imperatively. */
  readonly store: StoreApi<ViewportState>;
  /**
   * Multiplies the zoom by `factor` keeping the point at `anchor` (screen pixels from the
   * panel's center) still. Clamped to `MIN_ZOOM`..`MAX_ZOOM`.
   */
  zoomBy(factor: number, anchor?: { x: number; y: number }): void;
  /** Moves the frame by screen pixels. */
  panBy(dx: number, dy: number): void;
  /** Back to "fit in the panel", centered. */
  fit(): void;
}

/** The preview controller: its API plus cleanup, owned by the preview module. */
export interface PreviewController extends PreviewApi {
  /** Detaches the canvas, pauses the clock and drops every subscription. */
  dispose(): void;
}

/**
 * A layer drawn over the preview frame, such as the canvas tools' selection box. It fills the
 * frame exactly and moves and zooms with it, so it can position things in % of the frame.
 */
export interface PreviewOverlay {
  /** Unique id, `<module>.<name>`. */
  id: string;
  component: ComponentType;
}

/** A playing element against the clock, for deciding whether to seek it. */
export interface DriftState {
  /** Where the element is (seconds). */
  current: number;
  /** Where the clock wants it. */
  desired: number;
  /** Length of the file; `NaN` until known. */
  duration: number;
  /** Target of the seek in flight. */
  seekTarget: number | null;
  /** Milliseconds since the last seek. */
  sinceSeekMs: number;
  /** How fast the clip plays: the file runs away this much faster, so everything scales. */
  rate: number;
  /** Seconds the last seek took. */
  seekCost: number;
}

/** A junction whose overlap is under the playhead. */
export interface ActiveJunction {
  junction: Junction;
  /** 0 at the overlap's start → 1 at its end. */
  progress: number;
  /** Seconds since the overlap started. */
  elapsed: number;
}

/** What a picture is being drawn for: the live preview, a capture, or an export's frames. */
export type FilterTarget = "preview" | "capture" | "export";

/** What a picture filter is told about the picture it filters. */
export interface FilterInfo {
  /** The clip as drawn now: keyed values at this time, a live gesture's transform not included. */
  clip: Clip;
  project: ProjectState;
  /** Placement ids down to the clip, joined by "/" (the clip's own id at the top level). */
  path: string;
  /**
   * The size the passes run at: the picture's own size, or smaller in the live preview when it
   * lands smaller on the canvas. Captures and exports run at full size.
   */
  size: { width: number; height: number };
  /** The clock of the composition the clip sits in. */
  time: Micros;
  target: FilterTarget;
}

/** What a frame filter is told: a composition's composed frame instead of a clip. */
export type FrameFilterInfo = Omit<FilterInfo, "clip"> & {
  /** The composition whose frame is filtered (`path` is "" at the top, else its placement's). */
  composition: Composition;
};

/**
 * Changes a clip's own picture on the GPU before it lands (a color grade): it then scales, blends
 * and fades with the clip. Runs on media pictures (video after its levels, images) and on
 * placements (a composition clip's picture); clips that draw themselves (text, solids, stickers)
 * are not filtered. Contribute to `pictureFilters`.
 */
export interface PictureFilter {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** Lower runs first. */
  order: number;
  /** Whether it filters this clip; asked at every frame, so keep it cheap. */
  applies(clip: Clip, project: ProjectState): boolean;
  /**
   * False while something it needs is loading: the frame is held, like an undecoded video. Asking
   * may start the loading; ask the preview to redraw once it's there.
   */
  ready?(clip: Clip, project: ProjectState): boolean;
  /**
   * The passes, run after the filters before it, in one upload. Input -1 is the picture so far,
   * n the output of this filter's pass n. A throw (or a GPU failure) draws the picture without
   * the filter in the live preview and tells the user once; a capture or an export fails with
   * its message.
   */
  passes(info: FilterInfo): readonly GpuPass[];
}

/**
 * Changes a composition's composed frame on the GPU (a whole-timeline grade): at the top level
 * and inside each placement, before it lands. Contribute to `frameFilters`; it works like
 * `PictureFilter`.
 */
export interface FrameFilter {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** Lower runs first. */
  order: number;
  applies(composition: Composition, project: ProjectState): boolean;
  ready?(composition: Composition, project: ProjectState): boolean;
  passes(info: FrameFilterInfo): readonly GpuPass[];
}

/** What filters a readiness check asks (`logic/readiness.ts`). */
export interface FilterGate<S> {
  applies(subject: S, project: ProjectState): boolean;
  ready?(subject: S, project: ProjectState): boolean;
}

/** Passes and who they belong to, so a failure is reported by that id. */
export interface FilterPasses {
  id: string;
  passes: readonly GpuPass[];
}

/** How an engine draws pictures (`PreviewEngine.setPicture`). */
export interface PictureOptions {
  /** Draws no filters at all. */
  bypass: boolean;
  /**
   * 0…1, or null: the frame is drawn with filters, then again without them left of
   * `compare × width`.
   */
  compare: number | null;
  /** Passes run last over the whole canvas, in order, each after the ones before. */
  viewer: readonly FilterPasses[];
  /** Draws this top-level clip alone, or every clip when null. */
  only: ClipId | null;
}

/** What `captureAt` draws besides the defaults. */
export interface CaptureOptions {
  /** Leaves out every picture and frame filter. */
  bypassFilters?: boolean;
  /**
   * Draws this top-level clip alone, over the composition's background: no other clip, no
   * junction mix with the clip beside it, at Normal (its opacity kept). Its picture filters run,
   * and so do the composition's frame filters, unless `bypassFilters`.
   */
  only?: ClipId;
}

/** How the live preview shows pictures. View state: never in the project or history. */
export interface PictureViewState {
  /** Filters are bypassed (the "Bypass grades" switch). */
  bypass: boolean;
  /** The compare wipe at 0…1 of the width, or null when not comparing. */
  compare: number | null;
  /** Passes over the whole live canvas, by owner id (a false-color view, a highlight). */
  viewer: Readonly<Record<string, readonly GpuPass[]>>;
}

/** The live preview's picture: bypass, compare, viewer passes, and reading the drawn frame. */
export interface PreviewPictureApi {
  /** Read with `useStore(view, selector)` or subscribe imperatively. */
  readonly view: StoreApi<PictureViewState>;
  /** Draws the live preview without filters (on) or with them (off). Captures and exports ignore it. */
  setBypass(on: boolean): void;
  /**
   * Shows the frame with filters on the right of `wipe` (0…1 of the width) and without them on
   * its left; null ends comparing. Live preview only.
   */
  setCompare(wipe: number | null): void;
  /**
   * Sets an owner's passes, run last over the live canvas (after filters and compare), or removes
   * them (null). They never reach captures or exports. A failure is reported once by `id`.
   */
  setViewerPasses(id: string, passes: readonly GpuPass[] | null): void;
  /** Calls `listener` after each frame drawn on the live canvas. Returns the unsubscribe. */
  onFrame(listener: () => void): () => void;
  /**
   * The live canvas as drawn now, scaled down to at most `maxWidth` pixels wide (aspect kept) on a
   * small canvas of its own: for scopes, sample points and pickers. Null without a live canvas.
   */
  readFrame(maxWidth: number): ImageData | null;
}

/** The picture API and what the controller tells it (`preview.picture.ts`). */
export interface PictureControl extends PreviewPictureApi {
  /** The engine's options for the live view now; the same object until the view changes. */
  options(): PictureOptions;
  /** Tells `onFrame` listeners a frame was drawn. */
  drawn(): void;
}

/** The filters of one kernel, for its engines (`preview.filters.ts`). */
export interface PreviewFilters {
  /** The contributed filters, each list sorted by `order`; the same object until they change. */
  current(): FilterSet;
  /** Calls `listener` when a filter is contributed or removed. Returns the unsubscribe. */
  onChange(listener: () => void): () => void;
  /** A filter failed in the live preview: the user is told once per kernel per id. */
  failed(id: string, error: unknown): void;
}
