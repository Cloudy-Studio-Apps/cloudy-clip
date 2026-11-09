/**
 * Preview module: the playback clock, the preview engine, and the preview panel.
 * @module preview
 */
export { pause, play, seek, setLoop, togglePlay } from "./preview.commands";
export { HtmlMediaEngine } from "./engine/engine.html";
/**
 * Extension points the preview reads: `previewOverlays` (layers drawn over the frame),
 * `pictureFilters` (GPU passes on a clip's own picture before it lands: a clip's grade) and
 * `frameFilters` (GPU passes on a composition's composed frame: a whole-timeline grade). Contribute
 * with `ctx.contribute(point, …)`.
 */
export { frameFilters, pictureFilters, previewOverlays } from "./preview.points";
/**
 * Marks a pass uniform as a GLSL `int` (`gpuInt(2)`, or 2–4 numbers for `ivec2`…`ivec4`); a plain
 * number is a `float`.
 */
export { gpuInt } from "./gpu/gpu.programs";
/**
 * GLSL declaring `vec3 blend(int mode, vec3 base, vec3 top)`: every blend mode as the canvas does
 * it, `mode` being the index in `BLEND_MODES` (pass it with `gpuInt`). For a filter's own fragment.
 */
export { BLEND_GLSL } from "./gpu/gpu.blend";
/** A pass of the GPU runner (fragment, inputs, uniforms, data textures) and its data texture. */
export type { GpuPass, GpuTexture, GpuUniform } from "./gpu/gpu.types";
export { MAX_ZOOM, MIN_ZOOM } from "./preview.viewport";
/** How the user listens until told otherwise: stereo, not dimmed, speakers at 0 dB. */
export { DEFAULT_MONITOR } from "./logic/mix";
/**
 * The steady-state curve of a compressor or a gate (dBFS in to dBFS out), from the same detector
 * and gain the preview runs: for drawing a transfer graph that can't disagree with the sound.
 */
export { dynamicsTransfer } from "./logic/dynamics";
/** A linear peak in dBFS (full scale is 0), `-Infinity` for silence, as the meters read it. */
export { peakToDb } from "./logic/db";
export type {
  CaptureOptions,
  FilterInfo,
  FilterTarget,
  FrameFilter,
  FrameFilterInfo,
  FrameRenderer,
  FrameRendererOptions,
  LiveSound,
  LoopRange,
  LoudnessReading,
  MixLevels,
  MonitorState,
  PictureFilter,
  PictureViewState,
  PlaybackClock,
  PreviewApi,
  PreviewPictureApi,
  PreviewEngine,
  PreviewOverlay,
  PreviewSound,
  StereoLevel,
  TimeListener,
  VideoLevels,
  ViewportApi,
  ViewportState,
} from "./preview.types";

/**
 * Pieces of the preview for a page of its own: the stage with the frame (`bare` for a small one
 * with the field guide and no canvas tools; only the newest mounted stage is drawn on),
 * play/pause, and the timecode (`compact` for the time alone, hundredths muted).
 */
export { PlayButton, PreviewStage, Timecode } from "./ui";

/** Module definition, loaded by the app shell. */
export { previewModule } from "./preview.module";
/** Handle for `require(previewRef)` / `useModule(previewRef)`. */
export { previewRef } from "./preview.ref";
