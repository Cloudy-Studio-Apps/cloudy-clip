import type { ElementApi } from "@/modules/element";
import type { MixCanvases } from "./engine.mix";
import type { FontRequest } from "@/modules/fonts";
import type { JunctionApi } from "@/modules/junction";
import type { MediaApi } from "@/modules/media";
import type { Micros } from "@/core";
import type {
  DynamicsCommand,
  LiveSound,
  LoudnessReading,
  MixLevels,
  MonitorState,
  StereoLevel,
  VideoLevels,
} from "../preview.types";
import type {
  Clip,
  ClipSound,
  ClipSpeed,
  Composition,
  MasterMix,
  MediaId,
  ProjectFormat,
  ProjectState,
  SoundEffect,
  Track,
  TrackId,
  TrackMix,
} from "@/modules/project";

/** One pooled media element and what it is currently showing. */
export interface Slot {
  element: HTMLMediaElement;
  kind: "video" | "audio";
  mediaId: MediaId | null;
  /** URL currently loaded. Changes when a file gets its proxy, which forces a reload. */
  url: string | null;
  /** Path of the clip it plays, placements included (see `ResolvedClip`). */
  path: string | null;
  /** Target of the seek in flight, to avoid re-issuing it every frame. */
  seekTarget: number | null;
  /** `performance.now()` of the last seek. */
  lastSeekAt: number;
  /** Seconds the last seek took, so the next one can aim ahead of the moving clock. */
  seekCost: number;
  /** Counts seeks and loads, so a wait for an older one's frame can tell it is outdated. */
  seeks: number;
  /**
   * Whether the frame for the current position has actually been decoded. WebKit fires
   * `seeked` before that, so drawing at `seeked` can paint black.
   */
  presented: boolean;
}

/** The Web Audio chain of one sound element. */
export interface SoundChain {
  /**
   * Sets the sound, the level as a factor (volume, fades, crossfade and mute together) and the pan,
   * which is the sound's own unless inner tracks of a placement add theirs.
   */
  apply(sound: ClipSound, gain: number, pan?: number): void;
  /** Sends the chain into a bus; does nothing when it already goes there. */
  routeTo(bus: AudioNode): void;
}

/** One audio track of the open composition in a mix update. */
export interface MixTrack {
  id: TrackId;
  mix: TrackMix;
  muted: boolean;
}

/** Everything the buses play by: the document's mix with live values over it, solo and monitor. */
export interface MixUpdate {
  /** The open composition's audio tracks, top to bottom. */
  tracks: MixTrack[];
  master: MasterMix;
  /** Tracks soloed; none means every track sounds. */
  solo: TrackId[];
  monitor: MonitorState;
}

/** Web Audio for one engine. An element takes one `MediaElementSource`, ever. */
export interface SoundGraph {
  /**
   * Connects a sound element once; it stays connected for the element's life. When it can't,
   * the element plays plain and the user is told once, by `name` (the file's).
   */
  attach(element: HTMLMediaElement, name: string): SoundChain | undefined;
  /** The element's chain, if it has one. */
  chainOf(element: HTMLMediaElement): SoundChain | undefined;
  /**
   * Where a clip sounding through this top-level track goes: its bus, else the master; nothing
   * before the context exists.
   */
  busOf(trackId: TrackId): AudioNode | undefined;
  /** Makes and drops track buses and sets every level. Call it on a change, not per frame. */
  mix(update: MixUpdate): void;
  /** Peaks now; silence before any sound went through. */
  levels(): MixLevels;
  /** Loudness of the master since the last reset, measured while playing; null until measured. */
  loudness(): LoudnessReading | null;
  /** Starts the loudness measurement over. */
  resetLoudness(): void;
  /** Whether the engine plays: loudness is measured only then. Cheap to call per frame. */
  setPlaying(playing: boolean): void;
  dispose(): void;
}

/** What a placement passes to the clips inside it. */
export interface Nesting {
  /** The top-level track the placement sits on, whose bus its sound goes through. */
  bus: TrackId;
  /** The pan of the inner tracks above, summed. */
  pan: number;
}

/** Where a clip sounds from: the bus, and its gain and pan once inner tracks apply. */
export interface Placed {
  bus: TrackId;
  gain: number;
  pan: number;
}

/** The sound side of one engine: its graph, the live sound, and when the buses are set. */
export interface SoundMix {
  /** Null on a picture-only engine. */
  readonly graph: SoundGraph | null;
  /** A clip's sound with what its speed adds (`createSoundAtSpeed`). */
  heard(sound: ClipSound, speed: ClipSpeed): ClipSound;
  /** At each frame: sets the buses when the tracks, the composition or the live sound changed. */
  update(project: ProjectState, composition: Composition): void;
  /** New live sound from the controller, applied at once. */
  setSound(live: LiveSound): void;
  levels(): MixLevels;
  loudness(): LoudnessReading | null;
  resetLoudness(): void;
  /** Whether the engine plays (`SoundGraph.setPlaying`). */
  setPlaying(playing: boolean): void;
  dispose(): void;
}

/** How one active clip of an audio track sounds, worked out by the engine. */
export interface Voice {
  /** Volume, fades, crossfade, placements around it and inner tracks' volume, as a factor. */
  gain: number;
  /** Its pan, with the pans of inner tracks it sits in. */
  pan: number;
  /** A muted track above it, around a placement. */
  silenced: boolean;
  sound: ClipSound;
  /** The top-level track it sounds through: its own, or the one its placement sits on. */
  bus: TrackId;
  /** The file's name, for the report when its element can't enter the graph. */
  name: string;
}

/** Peak meter of one bus. */
export interface Meter {
  /** The peak of each side over the last few hundredths of a second. */
  read(): StereoLevel;
  dispose(): void;
}

/** One audio track's bus: upmix, its effects, pan, fader, and a meter after the fader. */
export interface TrackBus {
  input: GainNode;
  effects: EffectChain;
  panner: StereoPannerNode;
  fader: GainNode;
  meter: Meter;
}

/**
 * The effects of one bus, between two nodes it doesn't own (`createEffectChain`). The chain is
 * rebuilt only when its kinds, order or ids change (or the worklet becomes ready or fails); other
 * changes reach the nodes it has.
 */
export interface EffectChain {
  /**
   * Plays these effects, in order. `keyOf` gives the nodes a duck listens to (the listened
   * tracks after their faders); a track with no bus gives nothing.
   */
  set(effects: readonly SoundEffect[], keyOf: (trackId: TrackId) => AudioNode | undefined): void;
  dispose(): void;
}

/**
 * The dynamics worklet of one context (`createDynamicsNodes`): loaded once, in the background.
 * Until it's ready, and for good once it failed, effects that need it pass the sound dry.
 */
export interface DynamicsNodes {
  readonly state: "loading" | "ready" | "failed";
  /** A node running this effect, with a second input for a duck's key; null unless ready. */
  create(effect: DynamicsCommand): AudioWorkletNode | null;
  dispose(): void;
}

/** One effect of a chain, made: where sound goes in and out, and how a change reaches it. */
export interface EffectStage {
  input: AudioNode;
  output: AudioNode;
  update(effect: SoundEffect, keyOf: (trackId: TrackId) => AudioNode | undefined): void;
  dispose(): void;
}

/** The buses of one context: a track bus per audio track, the master and the monitor. */
export interface MixBus {
  /** The input of a track's bus, or the master's when the track has none. */
  inputOf(trackId: TrackId): AudioNode;
  /** The master after its fader and effects, before the monitor: what loudness is measured on. */
  readonly master: AudioNode;
  mix(update: MixUpdate): void;
  levels(): MixLevels;
  dispose(): void;
}

/** The loudness worklet listening to the master (`createLoudnessTap`). */
export interface LoudnessTap {
  /** The latest reading; null until the first arrives. */
  read(): LoudnessReading | null;
  /** Starts over, ignoring readings made before. */
  reset(): void;
  /** Measures only while active; inactive, the last reading stands. Posts only on a change. */
  setActive(active: boolean): void;
  dispose(): void;
}

/** A decoded picture and its size, ready to draw. */
export interface CachedPicture {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** What the HTML engine needs from the app. */
export interface EngineOptions {
  /** URL that streams a media item. */
  mediaUrl(id: MediaId): string;
  /** URL of the file played backwards, or null until that copy is ready. */
  reversedUrl?(id: MediaId): string | null;
  /** Calls `done` once that copy is ready. */
  whenReversed?(id: MediaId, done: () => void): void;
  /** Length of a file. */
  fileDuration?(id: MediaId): Micros | undefined;
  /** URLs of an image's picture at a moment of its clip, then those up to `ahead` later. */
  imageFrames: MediaApi["imageFrames"];
  /**
   * Whether a font face can be drawn now; when not, it starts loading and the engine draws text
   * in Inter (the caller redraws when it arrives).
   */
  ensureFont(request: FontRequest): boolean;
  /** The kinds of clip: how each one is drawn and its values. */
  elements: Pick<ElementApi, "get" | "resolve">;
  /** The kinds of junction: how two overlapping clips of a track are mixed, and their values. */
  junctions: Pick<JunctionApi, "get" | "resolve">;
  /** Called when a frame becomes available while paused (e.g. a seek finished). */
  onFrameReady(): void;
  /** Only pictures matter (offscreen capture): sound clips get no element at all. */
  pictureOnly?: boolean;
  /** How this webview draws video, when it needs correcting. Costs a read of every video frame. */
  videoLevels?: VideoLevels;
}

/** A track's clips under the playhead, in start order (two during a junction's overlap). */
export interface ActiveTrack {
  track: Track;
  clips: Clip[];
}

/** A clip under the playhead. */
export interface ResolvedClip {
  clip: Clip;
  /** Placement ids down to this clip, joined by "/". Keys elements and canvases. */
  path: string;
  /** The clock of the composition it sits in. */
  time: Micros;
  /** What it shows, when it plays a composition. */
  inner?: ResolvedFrame;
}

/** A track's clips under the playhead. */
export interface ResolvedTrack {
  track: Track;
  clips: ResolvedClip[];
}

/** A clip starting soon, at any depth. */
export interface UpcomingClip {
  path: string;
  clip: Clip;
  track: Track;
  /** The clock of the composition it sits in, once it shows. */
  time: Micros;
}

/** A composition at a time, placements included. */
export interface ResolvedFrame {
  composition: Composition;
  time: Micros;
  /** Top to bottom. */
  tracks: ResolvedTrack[];
  upcoming: UpcomingClip[];
}

/** How a frame is resolved. */
export interface FrameOptions {
  /** Leave sound out (offscreen capture). */
  pictureOnly: boolean;
  /** How far ahead a clip counts as upcoming. */
  preloadAhead: Micros;
}

/** One video track to draw at `time`. */
export interface TrackFrame extends ActiveTrack {
  project: ProjectState;
  /** Format of the composition being drawn. */
  format: ProjectFormat;
  time: Micros;
}

/**
 * Draws one clip onto `target` at its placement (a media frame or the element's own `draw`), with
 * its opacity and, unless `blend` is false, its blend mode.
 */
export type ClipDrawer = (target: CanvasRenderingContext2D, clip: Clip, blend?: boolean) => void;

/** One placement's offscreen picture, and the canvases for the transitions inside it. */
export interface NestedCanvas {
  ctx: CanvasRenderingContext2D;
  mix: MixCanvases;
}

/** What a placement lands on: a canvas, its format, and its pixels per output pixel. */
export interface PlacementTarget {
  on: CanvasRenderingContext2D;
  format: ProjectFormat;
  kx: number;
  ky: number;
}
