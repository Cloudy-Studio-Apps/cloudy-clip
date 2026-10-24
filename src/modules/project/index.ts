/**
 * Project module: the document (format, media, tracks, clips) and its selectors.
 * Other modules read it here and change it through their own commands.
 * @module project
 */
import type { ModuleDefinition } from "@/core";
import { projectCommands } from "./project.commands";
import { projectMcpTools } from "./project.mcp";

export { setFormat } from "./project.commands";
export { FORMAT_PRESETS, createEmptyProject, projectStore, resetProject } from "./project.store";
export {
  clipEnd,
  isMediaInUse,
  orderedTracks,
  projectDuration,
  trackClips,
} from "./project.selectors";
export type {
  Clip,
  ClipId,
  FormatPreset,
  MediaAsset,
  MediaId,
  MediaKind,
  ProjectFormat,
  ProjectState,
  Track,
  TrackId,
  TrackKind,
} from "./project.types";

/** Module definition, loaded by the app shell. */
export const projectModule: ModuleDefinition = {
  id: "project",
  name: "Project",
  commands: projectCommands,
  mcpTools: projectMcpTools,
};
