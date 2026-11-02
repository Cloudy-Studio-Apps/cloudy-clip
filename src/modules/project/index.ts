/**
 * Project module: the document (compositions, media, tracks, clips) and its selectors.
 * Other modules read it here and change it through their own commands.
 * @module project
 */
export { DEFAULT_FORMAT, createEmptyProject } from "./project.store";
export {
  clipEnd,
  compositionClips,
  compositionContent,
  compositionOf,
  formatOf,
  formatOfTrack,
  followsFileTime,
  frameDuration,
  isMediaInUse,
  orderedTracks,
  placementsOf,
  trackClips,
} from "./project.selectors";
export { contains } from "./logic/compositions";
export { useOpenComposition, useOpenFormat } from "./project.view.hook";
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
  orderedJunctions,
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
  Composition,
  CompositionId,
  CompositionView,
  CompositionViewState,
  PictureSize,
  MediaAsset,
  MediaId,
  MediaKind,
  ProjectApi,
  ProjectFormat,
  ProjectState,
  Bin,
  BinId,
  MediaInfo,
  MediaTag,
  Solid,
  SolidId,
  SharedGroupValues,
  Track,
  TrackId,
  TrackKind,
} from "./project.types";

export { seedProject } from "./project.testing";
export type { ProjectSeed } from "./project.testing";

/** Module definition, loaded by the app shell. */
export { createProjectModule, projectModule } from "./project.module";
/** Handle for `require(projectRef)` / `useModule(projectRef)`. */
export { projectRef } from "./project.ref";
