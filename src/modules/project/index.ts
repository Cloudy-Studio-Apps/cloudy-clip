/**
 * Project module: the document (format, media, tracks, clips) and its selectors.
 * Other modules read it here and change it through their own commands.
 * @module project
 */
export { setFormat } from "./project.commands";
export { FORMAT_PRESETS, createEmptyProject } from "./project.store";
export {
  clipEnd,
  formatPreset,
  isMediaInUse,
  orderedTracks,
  projectDuration,
  trackClips,
} from "./project.selectors";
export {
  IDENTITY_TRANSFORM,
  clipPlacement,
  clipTransform,
  normalizeRotation,
} from "./project.geometry";
export { partnersOf, withPartners } from "./logic/links";
export {
  allowedOverlap,
  applyMoves,
  findLayoutConflict,
  junctionBetween,
  junctionsOfClip,
  rippleMoves,
  staleJunctions,
} from "./logic/junctions";
export type {
  Clip,
  ClipMove,
  Junction,
  JunctionId,
  LayoutConflict,
  ClipFit,
  ClipId,
  ClipPlacement,
  ClipTransform,
  PictureSize,
  FormatPreset,
  MediaAsset,
  MediaId,
  MediaKind,
  ProjectApi,
  ProjectFormat,
  ProjectState,
  SharedGroupValues,
  Track,
  TrackId,
  TrackKind,
} from "./project.types";

/** Module definition, loaded by the app shell. */
export { createProjectModule, projectModule } from "./project.module";
/** Handle for `require(projectRef)` / `useModule(projectRef)`. */
export { projectRef } from "./project.ref";
