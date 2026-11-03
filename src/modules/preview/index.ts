/**
 * Preview module: the playback clock, the preview engine, and the preview panel.
 * @module preview
 */
export { pause, play, seek, togglePlay } from "./preview.commands";
export { HtmlMediaEngine } from "./engine/engine.html";
/** Layers drawn over the preview frame; contribute with `ctx.contribute(previewOverlays, …)`. */
export { previewOverlays } from "./preview.points";
export { MAX_ZOOM, MIN_ZOOM } from "./preview.viewport";
/** How the user listens until told otherwise: stereo, not dimmed, speakers at 0 dB. */
export { DEFAULT_MONITOR } from "./logic/mix";
/**
 * The steady-state curve of a compressor or a gate (dBFS in to dBFS out), from the same detector
 * and gain the preview runs: for drawing a transfer graph that can't disagree with the sound.
 */
export { dynamicsTransfer } from "./logic/dynamics";
export type {
  FrameRenderer,
  FrameRendererOptions,
  LiveSound,
  LoudnessReading,
  MixLevels,
  MonitorState,
  PlaybackClock,
  PreviewApi,
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
 * with no canvas tools; only the newest mounted stage is drawn on), play/pause, and the timecode.
 */
export { PlayButton, PreviewStage, Timecode } from "./ui";

/** Module definition, loaded by the app shell. */
export { previewModule } from "./preview.module";
/** Handle for `require(previewRef)` / `useModule(previewRef)`. */
export { previewRef } from "./preview.ref";
