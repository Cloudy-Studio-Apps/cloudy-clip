/**
 * Preview module: the playback clock, the preview engine, and the preview panel.
 * @module preview
 */
export { pause, play, seek, togglePlay } from "./preview.commands";
export { HtmlMediaEngine } from "./engine/engine.html";
/** Layers drawn over the preview frame; contribute with `ctx.contribute(previewOverlays, …)`. */
export { previewOverlays } from "./preview.points";
export { MAX_ZOOM, MIN_ZOOM } from "./preview.viewport";
export type {
  FrameRenderer,
  FrameRendererOptions,
  PlaybackClock,
  PreviewApi,
  PreviewEngine,
  PreviewOverlay,
  TimeListener,
  ViewportApi,
  ViewportState,
} from "./preview.types";

/** Module definition, loaded by the app shell. */
export { previewModule } from "./preview.module";
/** Handle for `require(previewRef)` / `useModule(previewRef)`. */
export { previewRef } from "./preview.ref";
