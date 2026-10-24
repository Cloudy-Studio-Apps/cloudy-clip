/**
 * Preview module: the playback clock, the preview engine, and the preview panel.
 * @module preview
 */
import type { ModuleDefinition } from "@/core";
import { previewCommands } from "./preview.commands";
import { previewMcpTools } from "./preview.mcp";

export { pause, play, seek, togglePlay } from "./preview.commands";
export { capturePreviewFrame, playback } from "./preview.controller";
export { HtmlMediaEngine } from "./engine/html-media-engine";
export { PreviewPanel } from "./components/PreviewPanel";
export type { PlaybackClock, PreviewEngine, TimeListener } from "./preview.types";

/** Module definition, loaded by the app shell. */
export const previewModule: ModuleDefinition = {
  id: "preview",
  name: "Preview",
  commands: previewCommands,
  mcpTools: previewMcpTools,
};
