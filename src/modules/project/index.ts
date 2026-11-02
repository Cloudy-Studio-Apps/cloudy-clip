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
  ClipSound,
  ClipSpeed,
  EasePresetId,
  EqBand,
  KeyEase,
  KeyTrack,
  KeyValue,
  Keyframe,
  Track,
  TrackId,
  TrackKind,
} from "./project.types";

/** A clip's speed, and the one place a timeline time becomes a time in its file. */
export {
  DEFAULT_SPEED,
  canChangeSpeed,
  elementTimeAt,
  filePlayed,
  sameSpeed,
  sourceSpan,
  sourceTimeAt,
  speedOf,
} from "./logic/speed";

/** A clip's sound: defaults, reading it, and the levels preview and export share. */
export {
  DEFAULT_SOUND,
  bandActive,
  dbToLinear,
  fadeLevel,
  pitchShift,
  soundOf,
} from "./logic/sound";

/** Keyframes: key tracks, their curves, and a clip's values at a time. */
export { EASE_PRESETS, easeProgress, presetOf } from "./logic/ease";
export { animatedClip, trackValue } from "./logic/animate";
export { mirrorEase, moveTrackKeys, withoutKeys, withoutTracks, writeKey } from "./logic/keys";
export { clampToClip, contentTime, rateAt, timeOfContent } from "./logic/content";
/** A speed ramp: the track's path, and the time a clip's content takes through it. */
export { RAMP_PATH, rampContentAt, rampOf, rampTimeAt } from "./logic/ramp";

export { seedProject } from "./project.testing";
export type { ProjectSeed } from "./project.testing";

/** Module definition, loaded by the app shell. */
export { createProjectModule, projectModule } from "./project.module";
/** Handle for `require(projectRef)` / `useModule(projectRef)`. */
export { projectRef } from "./project.ref";
