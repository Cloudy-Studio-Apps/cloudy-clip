import type { ActorId, Micros, PatchableStore } from "@/core";
import type { StoreApi } from "zustand/vanilla";

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
  width: number;
  height: number;
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
}

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
 * the frame and centered; then scaled, rotated about its center, and moved.
 */
export interface ClipTransform {
  /** Horizontal offset of the picture's center from the frame's center, in output pixels. */
  x: number;
  /** Vertical offset (down is positive), in output pixels. */
  y: number;
  /** Size relative to "fit": 1 fits the frame, 2 is twice as big. */
  scale: number;
  /** Clockwise rotation, in degrees (-180, 180]. */
  rotation: number;
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
}

/**
 * Values of the shared property groups (see the element module's `sharedGroups`), each stored on
 * the clip under its own key. A module that owns a shared group extends this interface.
 */
export interface SharedGroupValues {
  transform: ClipTransform;
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
