import type { ActorId, Micros, PatchableStore } from "@/core";
import type { StoreApi } from "zustand/vanilla";
import type {
  ClipGrade,
  GradeGroup,
  GradeGroupId,
  Lut,
  LutId,
  StillId,
  Still,
  StoredGradeVersion,
} from "./project.grade.types";

export * from "./project.grade.types";

export type MediaId = string;
export type TrackId = string;
export type ClipId = string;
export type CompositionId = string;
export type BinId = string;
export type SolidId = string;

/** What a file contains. Decided from its extension at import. Whether an image moves is read later, from the file. */
export type MediaKind = "video" | "audio" | "image";

/** A file the user imported. The file itself stays where it is; only its path is kept. */
export interface MediaAsset {
  id: MediaId;
  name: string;
  path: string;
  kind: MediaKind;
  /** Size in bytes. */
  size: number;
  /** The bin it sits in; missing means Master. */
  binId?: BinId;
  /** When it was imported, in ms since the epoch. Missing on older projects. */
  importedAt?: number;
  /** What's noted about the file. All its clips share it. */
  info?: MediaInfo;
}

/** How a file was judged. Untagged has no tag at all. */
export type MediaTag = "good" | "rejected";

/** What's noted about a file. Timecode and date are read from the file, so they aren't here. */
export interface MediaInfo {
  camera?: string;
  reel?: string;
  scene?: string;
  shot?: string;
  take?: string;
  tag?: MediaTag;
  color?: string;
  comments?: string;
}

/** A folder of the media library. Master isn't one: what has no bin sits there. */
export interface Bin {
  id: BinId;
  name: string;
  /** Null sits directly in Master. */
  parentId: BinId | null;
}

/** A colour in the library. A clip made from it keeps its own copy, so removing this breaks nothing. */
export interface Solid {
  id: SolidId;
  name: string;
  color: string;
  /** Its own size; missing means it matches the frame of whatever it's placed in. */
  width?: number;
  height?: number;
  /** What it paints; missing means `color`. */
  fillType?: "color" | "gradient";
  gradient?: Gradient;
  /** The bin it sits in; missing means Master. */
  binId?: BinId;
}

/**
 * Kind of track. Video tracks hold pictures only; audio tracks hold sound (from audio files or
 * the sound of video files).
 */
export type TrackKind = "video" | "audio";

/** A horizontal lane on the timeline. Clips on one track never overlap. */
export interface Track {
  id: TrackId;
  /** The composition this track belongs to. */
  compositionId: CompositionId;
  kind: TrackKind;
  name: string;
  /** Clips on this track, sorted by `start`. */
  clipIds: ClipId[];
  /** Silences every clip on the track. */
  muted: boolean;
  /** Hides the track's picture from the preview (video tracks). */
  hidden: boolean;
  /** How the track sounds in the mix, on audio tracks. Missing means the defaults (`DEFAULT_TRACK_MIX`). */
  mix?: TrackMix;
}

/** What an audio track does to the sound of its clips. Never stored at the defaults. */
export interface TrackMix {
  /** -60 to 12. */
  volumeDb: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** The group the track sends to; missing means Master. An id the composition lacks (a stale one) is tolerated and sends to Master. */
  busId?: BusId;
  /** The effects before the pan and the fader, in order. Missing means none; an empty chain is never stored. */
  effects?: SoundEffect[];
  /**
   * The track's volume drawn over time, in dB: a `KeyTrack` (`blend` "number", `min` -60, `max` 12)
   * whose keys' `t` is timeline time, so moving or splitting a clip never moves it. Holds before the
   * first key and after the last. The fader's `volumeDb` is an offset on top of it. Missing means
   * none; a line with no keys is never stored.
   */
  volumeLine?: KeyTrack;
}

/** What the master does to the sound of a whole composition. */
export interface MasterMix {
  /** -60 to 12. */
  volumeDb: number;
  /**
   * The master's input trim, -24 to 24 dB, on the sum before the fader (and its line), pan and
   * effects, after stems are taken: what Match target sets, so the fader stays the user's. Missing
   * means 0; 0 is never stored.
   */
  trimDb?: number;
  /** -1 (left) to 1 (right): a balance on the stereo mix, with a track pan's law. Missing means centred; 0 is never stored. */
  pan?: number;
  /** Silences the whole mix (stems are taken before the master, so they still sound). Missing means false; false is never stored. */
  muted?: boolean;
  /** The effects after the fader, in order. Missing means none; an empty chain is never stored. */
  effects?: SoundEffect[];
  /**
   * The master's volume drawn over time, in dB, as a track's `volumeLine` is (timeline time; the
   * fader's `volumeDb` an offset on top). Missing means none; a line with no keys is never stored.
   */
  volumeLine?: KeyTrack;
}

/** Which delivery standard a composition is measured against; `custom` has figures of its own. */
export type StandardId =
  "youtube" | "spotify" | "applePodcasts" | "tiktok" | "ebuR128" | "atscA85" | "custom";

/** What a composition is delivered against: a standard and its two figures (a standard's own, or the user's for `custom`). */
export interface DeliverySettings {
  standard: StandardId;
  /** The integrated loudness to reach, in LUFS (-40 to -5). */
  loudnessLufs: number;
  /** The true peak the mix may not pass, in dBTP (-20 to 0). */
  peakDbtp: number;
}

/** The id of a group track (`MixBus`), from `createId("bus")`. Unique across the project. */
export type BusId = string;

/**
 * A group track: audio tracks send to it in their `TrackMix.busId`, and it sends to Master only.
 * It has a fader and a chain (a duck on it may listen to tracks and groups).
 */
export interface MixBus {
  id: BusId;
  name: string;
  /** -60 to 12. */
  volumeDb: number;
  /** Silences everything sent to the group. */
  muted: boolean;
  /** The effects before the fader, in order. Missing means none; an empty chain is never stored. */
  effects?: SoundEffect[];
}

/** One of the two mixes of a composition: its audio tracks' mixes (those missing are at the defaults), its groups and its master. */
export interface MixSnapshot {
  tracks: Record<TrackId, TrackMix>;
  master: MasterMix;
  /** The groups of this mix; missing means none. */
  buses?: MixBus[];
}

/**
 * The mix of a composition. The live values are on the tracks (`Track.mix`) and in `master`;
 * `otherMix` holds the mix that is not active, swapped in by switching between A and B.
 */
export interface CompositionMix {
  master: MasterMix;
  /** The groups of the active mix, in order; missing means none, and an empty list is never stored. */
  buses?: MixBus[];
  /** Which of the two mixes the live values are. */
  activeMix: "a" | "b";
  /** The standard and target the mix is delivered against; shared by mixes A and B. Missing means YouTube's. */
  delivery?: DeliverySettings;
  /** The mix that is not active; missing until the first switch. */
  otherMix?: MixSnapshot;
}

/**
 * A clip on the timeline. Its `kind` names its element (`"media"`, `"text"`, a plugin's), which
 * declares its values; the clip stores only those that differ from the element's defaults, in
 * `props`. Shared group values (`transform`) live under their own key.
 */
export interface Clip extends Partial<SharedGroupValues> {
  id: ClipId;
  trackId: TrackId;
  /** The element: `"media"`, `"text"`, or a plugin's kind. */
  kind: string;
  /** Position on the timeline. */
  start: Micros;
  /** Where in the source file the clip begins (0 for elements without a source file). */
  sourceIn: Micros;
  /** Length on the timeline. The part of the file it plays is this at `speed` (`sourceSpan`). */
  duration: Micros;
  /** The element's own values (only those that differ from its defaults). */
  props: Record<string, unknown>;
  /** How it sounds, on clips of audio tracks. Missing means as the file does. */
  sound?: ClipSound;
  /** How fast it plays its file. Missing means normally (`DEFAULT_SPEED`). A `speed.rate` track overrides `rate`. */
  speed?: ClipSpeed;
  /** The file it plays (media clips). */
  mediaId?: MediaId;
  /** The composition it plays (composition clips); a live mirror of that composition. */
  compositionRef?: CompositionId;
  /** Stays on the timeline but isn't seen or heard, in preview or export. Missing means on. */
  disabled?: true;
  /**
   * Clips sharing a `linkId` are linked (a video's picture and its sound): they are selected,
   * moved, trimmed, split and deleted together until unlinked. Missing means unlinked.
   */
  linkId?: string;
  /**
   * Keyed values by path (`transform.x`, `fontSize`, `outline.width`), each a track of keys over
   * the clip's content time. Missing means nothing is animated.
   */
  animation?: Record<string, KeyTrack>;
  /** Content time at the clip's first frame. Missing means 0. */
  animationOrigin?: Micros;
  /** How it's colored. Missing means as the file is. Picture clips only (`canGrade`). */
  grade?: ClipGrade;
  /** Other versions of the grade by name; the active one is `grade`. */
  gradeVersions?: Record<string, StoredGradeVersion>;
  /** Name of the active version. Missing means "A". */
  gradeVersion?: string;
  /** The shot group whose grade runs after this clip's own. */
  gradeGroup?: GradeGroupId;
  /** Masks by id; `maskOrder` is the order they apply in. Picture clips only; missing means none. */
  masks?: Record<MaskId, ClipMask>;
  maskOrder?: MaskId[];
  /** The track whose picture decides where this clip shows. Missing means none. */
  matte?: ClipMatte;
}

/** One color of a gradient. `at` is its place along the gradient and `opacity` its alpha, each 0–1. */
export interface GradientStop {
  at: number;
  color: string;
  opacity: number;
}

/** A linear or radial fill. `angle` is clockwise in degrees, 0 left to right; radial ignores it. */
export interface Gradient {
  type: "linear" | "radial";
  angle: number;
  stops: GradientStop[];
}

/** What the content-time functions read of a clip. */
export type Timed = Pick<Clip, "start" | "duration" | "speed" | "animation" | "animationOrigin">;

/** A value a key can hold. */
export type KeyValue = number | string | boolean;

/** What a key does on the way to the next one. */
export type KeyEase =
  | { kind: "linear" }
  | { kind: "hold" }
  | { kind: "bezier"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "named"; name: "bounce" | "elastic" };

/** The ease presets, in the order the curve strip shows them. */
export type EasePresetId =
  | "linear"
  | "in"
  | "out"
  | "ease"
  | "snap"
  | "anticipate"
  | "overshoot"
  | "bounce"
  | "elastic"
  | "hold";

/** One key of a track: a value at a time on the clip's content. */
export interface Keyframe {
  id: string;
  /** Time on the clip's content (`contentTime`), never on the timeline. */
  t: Micros;
  value: KeyValue;
  /** What happens on the way to the next key. Missing means linear; ignored on the last key. */
  ease?: KeyEase;
  /** The handles on both sides of this key stay in line. */
  smooth?: true;
}

/** A value at a time, for `writeSpan`: a point of a drawn stroke or a fader pass, in the keys' time. */
export interface SpanPoint {
  t: Micros;
  value: KeyValue;
}

/** The keys of one animated value. */
export interface KeyTrack {
  /** How values blend: numbers and colors smoothly, everything else jumps. */
  blend: "number" | "color" | "step";
  /** The value sits under its own key on the clip (`transform.x`), not in `props`. */
  shared?: true;
  /** Copied from the property, so a curve that overshoots stays in range. */
  min?: number;
  max?: number;
  /** After the last key. Missing means hold the last value. */
  after?: "loop" | "pingpong";
  /** Sorted by `t`, at least one. */
  keys: Keyframe[];
}

/**
 * Placement of a clip's picture in the output frame. The picture is first fitted (contained) in
 * the frame; then scaled, stretched (and flipped) and rotated about its pivot, which sits at
 * `x`, `y` from the frame's center. With the pivot at its center (the default) `x`, `y` are the
 * offset of the picture's center.
 */
export interface ClipTransform {
  /** Horizontal offset of the pivot from the frame's center, in output pixels. */
  x: number;
  /** Vertical offset of the pivot (down is positive), in output pixels. */
  y: number;
  /** Size relative to "fit": 1 fits the frame, 2 is twice as big. */
  scale: number;
  /** Width factor on top of `scale`; negative mirrors the picture left to right. */
  scaleX: number;
  /** Height factor on top of `scale`; negative mirrors the picture upside down. */
  scaleY: number;
  /** Clockwise rotation, in degrees (-180, 180]. */
  rotation: number;
  /** Pivot in the picture, as a fraction of its width from its center (-0.5 is the left edge). */
  pivotX: number;
  /** Pivot in the picture, as a fraction of its height from its center (-0.5 is the top edge). */
  pivotY: number;
}

/**
 * How a clip's picture is sized before its transform: media pictures are fitted (contained) in
 * the frame; text keeps its natural size in output pixels.
 */
export type ClipFit = "contain" | "none";

/** Where a clip's picture lands in the output frame, in output pixels. */
export interface ClipPlacement {
  /** Center of the picture. */
  cx: number;
  cy: number;
  /** Size before rotation. */
  width: number;
  height: number;
  /** Clockwise, in degrees. */
  rotation: number;
  /** Mirrored left to right (a negative `scaleX`), after rotating. */
  flipX: boolean;
  /** Mirrored upside down (a negative `scaleY`), after rotating. */
  flipY: boolean;
}

/**
 * Values of the shared property groups (see the element module's `sharedGroups`), each stored on
 * the clip under its own key. A module that owns a shared group extends this interface.
 */
export interface SharedGroupValues {
  transform: ClipTransform;
  composite: ClipComposite;
  follow: ClipFollow;
}

/** Id of a motion path, unique in the project. */
export type PathId = string;

/**
 * A point of a motion path, in output pixels from the frame's center (the space of `transform.x`,
 * `transform.y`), with its two curve handles as offsets from it (0, 0 is a corner).
 */
export interface PathPoint {
  x: number;
  y: number;
  /** The handle toward the previous point. */
  inX: number;
  inY: number;
  /** The handle toward the next point. */
  outX: number;
  outY: number;
}

/**
 * A curve drawn on a composition's frame that clips can follow. Cubic Béziers between its
 * points, and from the last back to the first when `closed`. Never drawn in the picture.
 */
export interface MotionPath {
  id: PathId;
  compositionId: CompositionId;
  name: string;
  closed: boolean;
  /** At least two. */
  points: PathPoint[];
}

/**
 * How a clip follows a path (the `follow` shared group). While following, `transform.x` and
 * `transform.y` are an offset from the path's point.
 */
export interface ClipFollow {
  /** The path followed; empty means none. */
  pathId: PathId;
  /** Where on the path, by distance: 0 its start, 1 its end. A closed path wraps, an open one holds. */
  progress: number;
  /** Adds the path's direction to the rotation. */
  orient: boolean;
}

/** A place on a path: the point (output px from the frame's center) and its direction (degrees clockwise, 0 = right). */
export interface PathSample {
  x: number;
  y: number;
  angle: number;
}

/** Unsaved values over a clip while it is being edited (a slider being dragged), in its own terms. */
export interface FollowLive {
  transform?: Partial<ClipTransform>;
  follow?: Partial<ClipFollow>;
}

/** Which part of a point a drag moves: the point itself (its handles travel with it) or a handle. */
export type PointPart = "point" | "in" | "out";

/** A point or a direction in the frame, in output pixels. */
export interface Vec2 {
  x: number;
  y: number;
}

/** One cubic Bézier: its start, two control points and its end. */
export type BezierSegment = [Vec2, Vec2, Vec2, Vec2];

/** Lengths along a path: `lengths[s][i]` is the distance from its start to sample `i` of segment `s`. */
export interface PathLengthTable {
  segments: BezierSegment[];
  lengths: number[][];
  total: number;
}

/** What following a path adds to a clip's transform at a moment. */
export interface FollowShift {
  x: number;
  y: number;
  rotation: number;
}

/** The blend modes, in menu order. Each is a canvas operation (`preview`'s `canvasBlend`). */
export const BLEND_MODES = [
  "normal",
  "add",
  "multiply",
  "screen",
  "overlay",
  "softLight",
  "hardLight",
  "darken",
  "lighten",
  "colorDodge",
  "colorBurn",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
] as const;

/** How a clip's picture mixes with what's under it. */
export type BlendMode = (typeof BLEND_MODES)[number];

/** How a clip's picture lands on what's under it: a blend mode and an opacity from 0 to 1. */
export interface ClipComposite {
  mode: BlendMode;
  opacity: number;
}

/** One band of a clip's equalizer. */
export interface EqBand {
  on: boolean;
  shape: "bell" | "lowShelf" | "highShelf" | "lowCut" | "highCut";
  hz: number;
  db: number;
  q: number;
}

/** How a clip sounds. Missing means as the file does (`DEFAULT_SOUND`). */
export interface ClipSound {
  /** -60 to 12. */
  volumeDb: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  fadeIn: Micros;
  fadeOut: Micros;
  pitch: { on: boolean; semitones: number; cents: number };
  /** Always six bands. */
  eq: { on: boolean; bands: EqBand[] };
}

/** What every effect has: its id, and whether it works (off keeps the settings). */
export interface SoundEffectBase {
  id: string;
  on: boolean;
}

/** An equalizer: the six bands of a clip's EQ. */
export interface EqEffect extends SoundEffectBase {
  kind: "eq";
  bands: EqBand[];
}

/** A compressor (`acompressor`). */
export interface CompressorEffect extends SoundEffectBase {
  kind: "compressor";
  params: CompressorParams;
}

/** A noise gate (`agate`): silences what stays under the threshold. */
export interface GateEffect extends SoundEffectBase {
  kind: "gate";
  /** -80 to 0 dBFS. */
  thresholdDb: number;
  /** 1 to 20. */
  ratio: number;
  /** 0.01 to 2000 ms. */
  attackMs: number;
  /** 0.01 to 9000 ms. */
  releaseMs: number;
}

/** A de-esser (`deesser`): tames sibilance. */
export interface DeesserEffect extends SoundEffectBase {
  kind: "deesser";
  /** Where sibilance sits, 2000 to 12000 Hz. */
  frequencyHz: number;
  /** 0 (nothing) to 1 (most). */
  amount: number;
}

/** A limiter (`alimiter`): nothing goes over the ceiling. */
export interface LimiterEffect extends SoundEffectBase {
  kind: "limiter";
  /** -20 to 0 dBFS. */
  ceilingDb: number;
  /** 1 to 8000 ms. */
  releaseMs: number;
}

/** Noise reduction (`afftdn`), rendered to a file rather than run live. */
export interface DenoiseEffect extends SoundEffectBase {
  kind: "denoise";
  /** How much noise is taken away, 0 to 40 dB. */
  amountDb: number;
  /** The noise floor to remove, -80 to -20 dBFS. */
  floorDb: number;
}

/** A file heard through noise reduction: which, with which effect, and whether it plays backwards. */
export interface DenoiseNeed {
  mediaId: MediaId;
  denoise: DenoiseEffect;
  reversed: boolean;
}

/** Ducking (`sidechaincompress`): lowers the track while other tracks sound. */
export interface DuckEffect extends SoundEffectBase {
  kind: "duck";
  /** The tracks that lower this one; never a loop. */
  listensTo: TrackId[];
  /** How far they lower it, -40 to 0 dB. */
  depthDb: number;
  /** 0.01 to 2000 ms. */
  attackMs: number;
  /** 0.01 to 9000 ms. */
  releaseMs: number;
}

/** One effect in a chain on a track or the master; `kind` says which. */
export type SoundEffect =
  | EqEffect
  | CompressorEffect
  | GateEffect
  | DeesserEffect
  | LimiterEffect
  | DenoiseEffect
  | DuckEffect;

/** The kinds of effect. */
export type SoundEffectKind = SoundEffect["kind"];

/**
 * A compressor's settings, as FFmpeg's `acompressor` takes them but in dB and milliseconds
 * (peak detection, `level_in` and `mix` at 1). Preview and export run the same formula.
 */
export interface CompressorParams {
  /** Where gain reduction starts, -60 to 0 dBFS (`threshold`). */
  thresholdDb: number;
  /** Input dB above the threshold per output dB, 1 to 20 (`ratio`). */
  ratio: number;
  /** How fast the detector rises, 0.01 to 2000 ms (`attack`). */
  attackMs: number;
  /** How fast the detector falls, 0.01 to 9000 ms (`release`). */
  releaseMs: number;
  /** Width of the soft knee around the threshold, 0 to about 18 dB (`knee`, linear 1 to 8). */
  kneeDb: number;
  /** Gain added after compression, 0 to about 36 dB (`makeup`, linear 1 to 64). */
  makeupDb: number;
}

/**
 * The levels of the equal-power crossfades under junctions at a clip's start (`in`) and end
 * (`out`) at one time; 1 where none is.
 */
export interface CrossfadeLevels {
  in: number;
  out: number;
}

/** How a clip plays its file. Missing means normally (`DEFAULT_SPEED`). */
export interface ClipSpeed {
  /** 0.1 to 10; 0 holds one frame (Freeze frame). */
  rate: number;
  /** Keeps voices at their pitch; off, the sound rises and falls with the rate. */
  pitchCorrection: boolean;
  /** Plays its part of the file backwards. */
  reversed: boolean;
}

/** A speed ramp measured: the timeline time played (`times`) at each content time (`contents`). */
export interface RampTable {
  contents: number[];
  times: number[];
  /** What plays before the first key and after the last. */
  firstRate: number;
  lastRate: number;
}

/** Pixel size of a picture. */
export interface PictureSize {
  width: number;
  height: number;
}

/** Output canvas of a composition. */
export interface ProjectFormat {
  width: number;
  height: number;
  fps: number;
}

/**
 * Settings of one timeline, and that timeline's tracks. The timeline panel is a window on one
 * composition; a composition placed on another timeline is a clip that mirrors it.
 */
export interface Composition {
  id: CompositionId;
  name: string;
  /** Output size and frame rate. */
  format: ProjectFormat;
  /** CSS colour shown behind the clips when this composition is the output. */
  background: string;
  /** What it plays. Kept up to date while `extendToFit` is on. */
  duration: Micros;
  /** The duration follows the end of the last clip. */
  extendToFit: boolean;
  /**
   * Track order as shown, top to bottom. Video tracks higher in the list are drawn on top of
   * lower ones.
   */
  trackOrder: TrackId[];
  /** Its master and its two mixes. Missing means the defaults (`DEFAULT_COMPOSITION_MIX`). */
  mix?: CompositionMix;
  /** Whole-timeline grade, applied to this composition's frame (also where it's placed). */
  grade?: ClipGrade;
}

/**
 * The project document: everything that is part of the user's work. Changed only through
 * commands, so every change is undoable and visible to agents.
 */
export interface ProjectState {
  /** What the project is about, for the people and agents who open it. Missing when not given. */
  description?: string;
  compositions: Record<CompositionId, Composition>;
  /** Order in the Library. */
  compositionOrder: CompositionId[];
  /** Opens first and is exported later. Null only when there are no compositions. */
  mainCompositionId: CompositionId | null;
  media: Record<MediaId, MediaAsset>;
  /** Import order. */
  mediaOrder: MediaId[];
  bins: Record<BinId, Bin>;
  /** Order in the library. */
  binOrder: BinId[];
  solids: Record<SolidId, Solid>;
  /** Order in the library. */
  solidOrder: SolidId[];
  tracks: Record<TrackId, Track>;
  clips: Record<ClipId, Clip>;
  /** Things on the cut between two adjacent clips of one track (transitions). */
  junctions: Record<JunctionId, Junction>;
  /** Bookmarks on a composition's timeline, each its own record so each undoes on its own. */
  markers: Record<MarkerId, Marker>;
  /** Shot groups, each with a grade that runs after the grade of every clip in it. */
  gradeGroups?: Record<GradeGroupId, GradeGroup>;
  /** Imported `.cube` files, kept by path like media. */
  luts?: Record<LutId, Lut>;
  /** Grabbed frames with their grades. */
  stills?: Record<StillId, Still>;
  /** Motion paths clips can follow, each in one composition. Missing in projects without any. */
  paths?: Record<PathId, MotionPath>;
  /** Order of the stills. */
  stillOrder?: StillId[];
}

/** Id of a marker, unique in the project. */
export type MarkerId = string;

/** The colors a marker can have, in picker order. Stored by name; the marker module draws them. */
export const MARKER_COLORS = ["orange", "yellow", "green", "blue", "purple", "pink"] as const;

/** One of {@link MARKER_COLORS}. */
export type MarkerColor = (typeof MARKER_COLORS)[number];

/** How each marker color is drawn. Fixed: the color is the user's label (markers, masks), not chrome. */
export const MARKER_HEX: Record<MarkerColor, string> = {
  orange: "#e8772e",
  yellow: "#e3bd2f",
  green: "#6f9a3a",
  blue: "#5f9fd6",
  purple: "#8f7ac8",
  pink: "#d4488f",
};

/** A bookmark at one moment of a composition: a colored flag in the ruler with an optional note. */
export interface Marker {
  id: MarkerId;
  compositionId: CompositionId;
  /** Where it sits on the composition's timeline. May lie past the composition's end. */
  time: Micros;
  /** What it is for; may be empty. */
  note: string;
  color: MarkerColor;
}

/** Id of a junction, unique in the project. */
export type JunctionId = string;

/** Something on the cut between two adjacent clips of one track. */
export interface Junction {
  id: JunctionId;
  kind: string;
  trackId: TrackId;
  leftClipId: ClipId;
  rightClipId: ClipId;
  /** Overlap of the two clips; 0 for kinds that don't overlap. */
  duration: Micros;
  props: Record<string, unknown>;
}

/** A clip's new start on the timeline. */
export interface ClipMove {
  clipId: ClipId;
  start: Micros;
}

/** Two clips of one track that overlap where they may not (or `clip` starts before 0, `other` is `clip`). */
export interface LayoutConflict {
  clip: Clip;
  other: Clip;
}

/** What each actor has open. View state: never in the document, never undoable. */
export interface CompositionViewState {
  /** An actor's open composition; `null` once they closed everything, missing means Main. */
  open: Record<ActorId, CompositionId | null>;
  /** The user's tabs above the timeline. */
  tabs: CompositionId[];
}

/** Who has which composition open. An agent's never moves the user's. */
export interface CompositionView {
  store: StoreApi<CompositionViewState>;
  /** The composition `actor` has open: theirs, else Main; null when none. */
  openFor(actor: ActorId): CompositionId | null;
  /** Opens a composition for `actor`, or closes everything with `null`. */
  setOpen(actor: ActorId, id: CompositionId | null): void;
  /** Removes a tab; the user moves to its neighbour when it was open. Nothing is lost. */
  closeTab(id: CompositionId): void;
  /** The composition `actor` has open. Throws `composition.none_open` when there is none. */
  requireOpen(actor: ActorId): Composition;
  /** Format of the composition `actor` has open; the default when there is none. */
  formatFor(actor: ActorId): ProjectFormat;
  /** Forgets everyone's open composition and the tabs: another document was opened. */
  reset(): void;
  dispose(): void;
}

/** The project module's API for one kernel. */
export interface ProjectApi {
  /**
   * The project document. Read freely (`getState`, `useStore(store.api, selector)`); change it
   * only through commands (`ctx.mutate`), so every change is undoable.
   */
  readonly store: PatchableStore<ProjectState>;
  /** Who has which composition open. */
  readonly view: CompositionView;
}

/** Id of a mask, unique in its clip. */
export type MaskId = string;

/** Id of a point of a mask path, unique in its mask. */
export type PointId = string;

/** How a mask combines with the ones before it. */
export type MaskMode = "add" | "subtract" | "intersect" | "difference";

/** The shape of a mask, in the clip's fitted picture space (see {@link MaskMapping}). */
export type MaskShape =
  | { kind: "rectangle"; width: number; height: number; roundness: number }
  | { kind: "ellipse"; width: number; height: number }
  | { kind: "star"; width: number; height: number; points: number; inner: number }
  | { kind: "heart"; width: number; height: number }
  | { kind: "linear" }
  | { kind: "mirror"; width: number }
  | {
      kind: "path";
      scale: number;
      points: Record<PointId, PathPoint>;
      pointOrder: PointId[];
    };

/** A mask on a clip: a shape in the fitted picture, centered at (`x`, `y`) from the picture's center. */
export interface ClipMask {
  id: MaskId;
  name: string;
  /** Its outline on the canvas. */
  color: MarkerColor;
  /** Missing means on. */
  on?: false;
  mode: MaskMode;
  invert?: true;
  /** 0 to 1. */
  opacity: number;
  /** Picture px (Gaussian radius, about 2 sigma). */
  feather: number;
  /** Picture px; grows (+) or shrinks (-) the shape. */
  expansion: number;
  x: number;
  y: number;
  /** Degrees, clockwise. */
  rotation: number;
  shape: MaskShape;
}

/** A clip shown only where another track's picture is (or isn't, with `invert`). */
export interface ClipMatte {
  /** A video track of the clip's composition. */
  trackId: TrackId;
  by: "alpha" | "luma";
  invert?: true;
}

/** Where a mask's space sits in the frame: a point (px, py) lands at `rotate((px*sx, py*sy), rotation) + (cx, cy)`. */
export interface MaskMapping {
  cx: number;
  cy: number;
  /** Degrees, clockwise. */
  rotation: number;
  /** Placed over fitted size, signed by the flip. */
  sx: number;
  sy: number;
}

/** The allowed range of each mask number, by field name. */
export const MASK_RANGES: Record<string, { min: number; max: number }> = {
  opacity: { min: 0, max: 1 },
  feather: { min: 0, max: 2000 },
  expansion: { min: -2000, max: 2000 },
  x: { min: -100000, max: 100000 },
  y: { min: -100000, max: 100000 },
  width: { min: 1, max: 100000 },
  height: { min: 1, max: 100000 },
  roundness: { min: 0, max: 1 },
  points: { min: 3, max: 24 },
  inner: { min: 0.05, max: 1 },
  scale: { min: 0.01, max: 20 },
};
