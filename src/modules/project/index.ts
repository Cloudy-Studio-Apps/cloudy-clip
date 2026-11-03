/**
 * Project module: the document (compositions, media, tracks, clips) and its selectors.
 * Other modules read it here and change it through their own commands.
 * @module project
 */
/** A new, empty document and the format a new composition takes. */
export { DEFAULT_FORMAT, createEmptyProject } from "./project.store";
/** Reading the document: clips, tracks, compositions and their formats. */
export {
  clipEnd,
  compositionClips,
  compositionContent,
  compositionMarkers,
  compositionOf,
  formatOf,
  formatOfTrack,
  followsFileTime,
  frameDuration,
  isMediaInUse,
  orderedTracks,
  placementsOf,
  requireComposition,
  trackClips,
} from "./project.selectors";
/** The blend modes, in menu order, and the marker colors, in picker order. */
export { BLEND_MODES, MARKER_COLORS } from "./project.types";
/** Whether a composition holds another, at any depth. */
export { contains } from "./logic/compositions";
/** The composition open in the editor, and its format, for React. */
export { useOpenComposition, useOpenFormat } from "./project.view.hook";
/** Where a clip's picture sits in the frame: the one place that computes it. */
export {
  IDENTITY_COMPOSITE,
  IDENTITY_TRANSFORM,
  clipPlacement,
  clipComposite,
  clipTransform,
  normalizeRotation,
} from "./project.geometry";
/** Linked clips: a clip's partners. */
export { partnersOf, withPartners } from "./logic/links";
/** Junctions and layout: overlaps, ripples and the junctions a layout leaves stale. */
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
/** The document's types. */
export type {
  Clip,
  ClipMove,
  Junction,
  JunctionId,
  LayoutConflict,
  ClipFit,
  ClipId,
  ClipPlacement,
  BlendMode,
  Gradient,
  GradientStop,
  ClipComposite,
  ClipTransform,
  Composition,
  CompositionId,
  CompositionView,
  CompositionViewState,
  PictureSize,
  Marker,
  MarkerColor,
  MarkerId,
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
  CompressorParams,
  CrossfadeLevels,
  CompositionMix,
  MasterMix,
  MixSnapshot,
  TrackMix,
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
  minimize,
  panSide,
  pitchShift,
  soundOf,
} from "./logic/sound";
/** The schemas of sound values, shared by every command that sets them. */
export {
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  eqBandSchema,
  eqSchema,
  panSchema,
  volumeDbSchema,
} from "./logic/sound.schema";

/** The mix of an audio track and of a composition: defaults, reading them, and the nested level. */
export {
  DEFAULT_COMPOSITION_MIX,
  DEFAULT_TRACK_MIX,
  compositionMixOf,
  minimizeTrackMix,
  soundInPlacement,
  trackMixOf,
} from "./logic/mix";

/** Key curves: the ease presets and how far along an ease a segment is. */
export { EASE_PRESETS, easeProgress, presetOf } from "./logic/ease";
/** A key track's value at a time, and a clip with every keyed value written in. */
export { animatedClip, trackValue } from "./logic/animate";
/** Editing key tracks: writing, moving and removing keys, and mirroring an ease. */
export { mirrorEase, moveTrackKeys, withoutKeys, withoutTracks, writeKey } from "./logic/keys";
/** A clip's content time (where its keys sit) and timeline time, both ways, and its rate. */
export { clampToClip, contentTime, rateAt, timeOfContent } from "./logic/content";
/** A speed ramp: the track's path, and the time a clip's content takes through it. */
export { RAMP_PATH, rampContentAt, rampOf, rampTimeAt } from "./logic/ramp";

/** A whole document from a few parts, for tests. */
export { seedProject } from "./project.testing";
/** The parts `seedProject` takes. */
export type { ProjectSeed } from "./project.testing";

/** Module definition, loaded by the app shell. */
export { createProjectModule, projectModule } from "./project.module";
/** Handle for `require(projectRef)` / `useModule(projectRef)`. */
export { projectRef } from "./project.ref";
