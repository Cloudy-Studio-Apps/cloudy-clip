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
  ClipFollow,
  FollowShift,
  MotionPath,
  PathId,
  PathPoint,
  PathSample,
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
  ChannelJoin,
  ChannelSplit,
  ClipGrade,
  Correction,
  CorrectionValues,
  CurvePoints,
  GradeGroup,
  GradeGroupId,
  GradeLimit,
  GradeNode,
  GradeNodeId,
  GradePos,
  InputColorSpace,
  KeyJoin,
  LayerJoin,
  Lut,
  LutId,
  MixFamily,
  MixFamilyName,
  NodeRef,
  ParallelJoin,
  Still,
  StillId,
  StoredGradeVersion,
  Wheel,
  ZoneName,
  ZoneWheel,
  CompressorParams,
  CompressorEffect,
  DeesserEffect,
  DenoiseEffect,
  DenoiseNeed,
  DuckEffect,
  EqEffect,
  GateEffect,
  LimiterEffect,
  SoundEffect,
  SoundEffectBase,
  SoundEffectKind,
  CrossfadeLevels,
  BusId,
  CompositionMix,
  DeliverySettings,
  StandardId,
  MasterMix,
  MixBus,
  MixSnapshot,
  TrackMix,
  ClipSpeed,
  EasePresetId,
  EqBand,
  KeyEase,
  KeyTrack,
  KeyValue,
  Keyframe,
  SpanPoint,
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

/** The eight families of color mix and the six zones, in order. */
export { MIX_FAMILIES, ZONE_NAMES } from "./project.types";
/** A clip's grade: the defaults of a correction, the ranges of its values and of a limit's numbers, the size of the warper grid, reading, minimizing and who can have one. */
export {
  BUILTIN_LUT_PREFIX,
  DEFAULT_CORRECTION,
  GRADE_RANGES,
  LIMIT_RANGES,
  WARPER_POINTS,
  canGrade,
  correctionOf,
  gradeOf,
  minimizeGrade,
} from "./logic/grade";
/** The graph rules of a grade (refs, cycles, ranges), what each node reads, and the schema every command setting one is built from. */
export {
  gradeInputs,
  gradeKeys,
  renameGradeKeys,
  gradeReads,
  keyFromAbove,
  validateGrade,
} from "./logic/grade.validate";
export {
  correctionValuesSchema,
  gradeLimitSchema,
  gradeNodeSchema,
  gradeSchema,
  INPUT_SPACES,
  nodeRefSchema,
} from "./logic/grade.schema";

/** A clip's sound: defaults, reading it, and the levels preview and export share. */
export {
  DEFAULT_SOUND,
  bandActive,
  dbToLinear,
  fadeLevel,
  formatDb,
  minimize,
  panSide,
  pitchShift,
  soundOf,
} from "./logic/sound";
/** The schema of each kind of effect, the bounds of their values, and the list of kinds. */
export {
  EFFECT_RANGES,
  SOUND_EFFECT_KINDS,
  compressorParamsSchema,
  effectSchemas,
  soundEffectSchema,
} from "./logic/effect.schema";
/** The schema of a `#rrggbb` colour: case-insensitive, stored lowercase. */
export { hexColor } from "./logic/color.schema";
/** The schema of a key's ease, shared by every command that sets one. */
export { keyEase } from "./logic/keys.schema";
/** The schemas of sound values, shared by every command that sets them. */
export {
  TRIM_DB_MAX,
  TRIM_DB_MIN,
  VOLUME_DB_MAX,
  VOLUME_DB_MIN,
  eqBandSchema,
  eqSchema,
  panSchema,
  trimDbSchema,
  volumeDbSchema,
} from "./logic/sound.schema";

/** The mix of an audio track and of a composition: defaults, reading them, and the nested level. */
export {
  DEFAULT_COMPOSITION_MIX,
  DEFAULT_TRACK_MIX,
  compositionMixOf,
  minimizeCompositionMix,
  minimizeTrackMix,
  soundInPlacement,
  trackBus,
  trackMixOf,
} from "./logic/mix";

/** Noise reduction: which one a track's clips are heard through, and the files that need it. */
export { denoiseNeeds, heardDenoise } from "./logic/denoise";

/** Key curves: the ease presets and how far along an ease a segment is. */
export { EASE_PRESETS, easeProgress, presetOf } from "./logic/ease";
/**
 * A key track's value at a time, the times its keys fall on in a stretch (loops included), a
 * clip with every keyed value written in, and points thinned to those off a straight line
 * (`simplify`: export envelopes, drawn strokes and fader passes).
 */
export { animatedClip, keyMoments, simplify, trackValue } from "./logic/animate";
/** Motion paths: a place on a path by distance (`pathPointAt`) and its length. */
export { pathLength, pathPointAt } from "./logic/path";
/**
 * Clips following paths: where one is placed at a time (`followedClip`, used by every placement
 * of a picture), what its path adds (`followShift`), leaving a path in place (`bakeFollow`),
 * copying followed paths into another composition and scaling a path with its frame.
 */
export {
  bakeFollow,
  copyFollowedPaths,
  followedClip,
  followShift,
  NO_FOLLOW,
  scalePath,
} from "./logic/follow";
/**
 * Editing key tracks: writing, moving and removing keys, replacing a span with straight points
 * while the rest plays as before (`writeSpan`), and mirroring an ease.
 */
export {
  mirrorEase,
  moveTrackKeys,
  withoutKeys,
  withoutTracks,
  writeKey,
  writeSpan,
} from "./logic/keys";
/** A clip's content time (where its keys sit) and timeline time, both ways, and its rate. */
export { clampToClip, clipHasKeys, contentTime, rateAt, timeOfContent } from "./logic/content";
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
