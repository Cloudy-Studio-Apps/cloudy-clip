/**
 * Preview module: the playback clock, the preview engine, and the preview panel.
 * @module preview
 */
export { pause, play, seek, togglePlay } from "./preview.commands";
export { capturePreviewFrame, playback } from "./preview.controller";
export { HtmlMediaEngine } from "./engine/html-media-engine";
export type { PlaybackClock, PreviewEngine, TimeListener } from "./preview.types";

/** Module definition, loaded by the app shell. */
export { previewModule } from "./preview.module";
/** Handle for `require(previewRef)` / `useModule(previewRef)`. */
export { previewRef } from "./preview.ref";
