/**
 * Project module: the document (format, media, tracks, clips) and its selectors.
 * Other modules read it here and change it through their own commands.
 * @module project
 */
export { setFormat } from "./project.commands";
export { FORMAT_PRESETS, createEmptyProject } from "./project.store";
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
  ProjectApi,
  ProjectFormat,
  ProjectState,
  Track,
  TrackId,
  TrackKind,
} from "./project.types";

/** Module definition, loaded by the app shell. */
export { createProjectModule, projectModule } from "./project.module";
/** Handle for `require(projectRef)` / `useModule(projectRef)`. */
export { projectRef } from "./project.ref";
