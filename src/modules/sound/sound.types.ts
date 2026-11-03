import type { RefObject } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { CommandBus, Micros } from "@/core";
import type {
  CompositionId,
  CompressorEffect,
  GateEffect,
  SoundEffect,
  TrackId,
} from "@/modules/project";
import type { MonitorState, PlaybackClock } from "@/modules/preview";
import type { MediaApi } from "@/modules/media";
import type { ProjectApi } from "@/modules/project";
import type { WorkspaceApi } from "@/modules/workspace";

/** What the Sound page shows and how the user listens, per kernel. Never in history. */
export interface SoundViewState {
  /**
   * The strip that is marked, or null: an audio track (its header is marked too) or the master. Its
   * chain shows in the Channel tab. A track, not clips.
   */
  selected: MixTarget | null;
  /** Soloed tracks; none means every track sounds. Never in an export. */
  solo: TrackId[];
  /** The mixer takes the whole page (Expand all). */
  expanded: boolean;
  /** Mono, Dim and the speaker volume. Never in an export. */
  monitor: MonitorState;
  /** The track a recording goes onto: an audio track that isn't muted. */
  armed: TrackId | null;
}

/** The sound module's API, per kernel. */
export interface SoundApi {
  /** The page's view state. Solo and the monitor change through `sound.setSolo` / `sound.setMonitor`. */
  view: StoreApi<SoundViewState>;
  /** Marks a track's strip and header, the master's strip, or none. */
  select(target: MixTarget | null): void;
  /**
   * The user's own presets, kept in `localStorage`. Changed by `sound.savePreset`,
   * `sound.renamePreset` and `sound.removePreset`.
   */
  presets: StoreApi<UserPresets>;
  /** Lets the mixer take the whole page, or gives the timeline its place back. */
  setExpanded(expanded: boolean): void;
  /** Arms a track for recording, or none. Refused (nothing changes) while a take is recorded. */
  arm(trackId: TrackId | null): void;
  /** Records the microphone onto the armed track. */
  recorder: Recorder;
}

/** Where the webview runs, for what has been checked there. */
export type RecordPlatform = "linux" | "windows" | "macos" | "android";

/** What the record worklet is told: keep samples from now (or not), or hand over the rest and stop. */
export type RecordCommand = { keep: boolean } | { flush: true };

/** The microphone, open and feeding the recorder. */
export interface Capture {
  /** The rate the samples come at: the capture context's own. */
  sampleRate: number;
  /** Starts handing samples over, from the next block. */
  keep(): void;
  /** Hands over the samples still gathered, then closes the microphone and the context. */
  stop(): Promise<void>;
}

/** Where a take's file was started (`sound_record_begin`). */
export interface TakeStarted {
  /** For `sound_record_write`. */
  id: string;
  path: string;
}

/** What a write left on disk (`sound_record_write`). */
export interface TakeWritten {
  /** Null once a take with no samples was finished: its file is deleted. */
  path: string | null;
  samples: number;
}

/** What the recorder is doing. View state, never in history. */
export interface RecorderState {
  /** `starting`: opening the microphone and the file; `stopping`: writing the end and placing it. */
  status: "idle" | "starting" | "recording" | "stopping";
  trackId: TrackId | null;
  /** Where the take starts on the timeline. */
  at: Micros;
}

/** Records the microphone into a WAV beside the project and places it as a clip. One take at a time. */
export interface Recorder {
  state: StoreApi<RecorderState>;
  /** Opens the microphone, starts playback and records onto `trackId`. Tells the user when it can't. */
  start(trackId: TrackId): Promise<void>;
  /**
   * Stops the take and places it (`sound.placeRecording`), or tells the user why not, naming the
   * file. While a stop is under way, returns that one, so a caller can wait for the placement.
   * `pause: false` leaves playback running (a play the user asked for ended the take).
   */
  stop(options?: { pause?: boolean }): Promise<void>;
  /** Arms a track (or none), unless a take is under way. */
  arm(trackId: TrackId | null): void;
  /** The latest input peak in dBFS, `-Infinity` when not recording. Read per frame. */
  level(): number;
  /** How long the take is so far. Read per frame. */
  length(): Micros;
}

/** What the recorder needs. */
export interface RecorderDeps {
  bus: CommandBus;
  playback: PlaybackClock;
  project: ProjectApi;
  media: MediaApi;
  workspace: WorkspaceApi;
  /** The Sound page's view: `armed` lives there. */
  view: StoreApi<SoundViewState>;
}

/** A take as the recorder keeps it. */
export interface LiveTake {
  trackId: TrackId;
  at: Micros;
  /** Samples are kept (after playback started) until the take stops. */
  keeping: boolean;
  /** Stop was asked for. While still starting, `start` closes the take itself. */
  ending: boolean;
  /** The stop under way: finishing the file and placing it. */
  finishing: Promise<void> | null;
  capture: Capture | null;
  file: TakeStarted | null;
  rate: number;
  /** Samples not sent yet. */
  chunks: Int16Array[];
  chunked: number;
  /** Samples kept, sent or not. */
  samples: number;
  /** The latest input peak, dBFS. */
  level: number;
  /** The writes, one after another. */
  writes: Promise<void>;
  /** The last answer from the native side. */
  written: TakeWritten | null;
  /** The first write that failed. */
  failure: unknown;
}

/** What a mixer strip addresses: an audio track, or the master. */
export type MixTarget = TrackId | "master";

/** Where a chain command acts: a track, or the master of `compositionId` (default: the open one). */
export interface ChainWhere {
  target: MixTarget;
  compositionId?: CompositionId;
}

/** The loudest level seen lately, held for a while so the eye can catch it. */
export interface PeakHold {
  /** dBFS. */
  db: number;
  /** When it was reached, in ms (`performance.now()`). */
  at: number;
}

/** What a meter shows: a track's or the master's level, or the microphone while recording. */
export type MeterTarget = MixTarget | "input";

/** One side of one meter, registered with the meter loop. */
export interface MeterSide {
  target: MeterTarget;
  side: "left" | "right";
  /** Drawn from the bottom up to the level. */
  bar: HTMLElement;
  /** The peak hold line. */
  hold: HTMLElement;
}

/** A meter side as the loop keeps it: what it last wrote, so it writes only changes. */
export interface MeterEntry extends MeterSide {
  /** 0 to 1; -1 before the first write. */
  height: number;
  holdHeight: number;
  peak: PeakHold | null;
}

/** The one animation-frame loop that feeds every meter on the page. */
export interface MeterLoop {
  /** Starts feeding a meter side. Returns what stops it. */
  register(meter: MeterSide): () => void;
  /** Reads the levels on every frame. */
  start(): void;
  /** Stops reading and empties every meter. */
  stop(): void;
}

/** A drag along a fader or a slider. Values are 0 to 1 along it (bottom to top, left to right). */
export interface FaderDrag {
  down: PointerEvent;
  /** The groove the handle moves in. */
  track: HTMLElement;
  axis: "x" | "y";
  /** Where the handle is when the drag starts. */
  start: number;
  /** The press landed on the handle: it moves by the pointer's travel, not to the pointer. */
  grabbed: boolean;
  /** Every move. */
  onMove(position: number): void;
  /** The release, with the last position; null when the pointer never moved. */
  onEnd(position: number | null): void;
}

/** A value set by dragging along a groove: a fader, the pan, the speaker volume. */
export interface SliderOptions {
  axis: "x" | "y";
  /** The groove. */
  trackRef: RefObject<HTMLElement | null>;
  /** The handle: a press on it moves it by the pointer's travel. */
  handleRef: RefObject<HTMLElement | null>;
  /** Where a value sits along the groove, 0 to 1. */
  toPosition(value: number): number;
  /** The value at a position along the groove. */
  fromPosition(position: number): number;
  /** What a double-click returns to. */
  rest: number;
  /** Writes a value to the DOM (handle, readout); called on every move and after a commit. */
  place(value: number): void;
  /** Every move of a drag: play it live, change nothing yet. Null: stop playing it live. */
  onInput(value: number | null): void;
  /** The release with a new value, or a double-click: send the one command. */
  onCommit(value: number): Promise<void>;
  /** The value the document holds now. */
  read(): number;
}

/** The tabs of the panel under the Sound page's timeline. */
export type SoundPanelTab = "clip" | "channel" | "loudness";

/** What the Loudness tab tells its history graph. */
export interface LoudnessHistoryHandle {
  /** Adds a short-term reading (LUFS; `-Infinity` before one exists), sampled while playing. */
  push(shortTerm: number): void;
  /** Starts the history over (Reset). */
  clear(): void;
}

/** Colours the loudness graph draws with, read from the theme's tokens. */
export interface GraphColours {
  grid: string;
  line: string;
}

/** How far a chain's noise reduction is rendered into its files. */
export interface DenoiseRendering {
  /** 0..1, the mean of the files rendering or waiting their turn; undefined while none is. */
  progress?: number;
  /** Why a file's rendering failed, while one has; changing a setting tries it again. */
  failed?: string;
}

/** An effect without its id, as a preset holds it: each use gets a fresh id. */
export type EffectSpec = SoundEffect extends infer E
  ? E extends SoundEffect
    ? Omit<E, "id">
    : never
  : never;

/** The spec of one kind of effect. */
export type EffectSpecOf<K extends SoundEffect["kind"]> = Extract<EffectSpec, { kind: K }>;

/** A named chain of effects. Applying it writes plain values: a project never depends on a preset. */
export interface SoundPreset {
  id: string;
  name: string;
  /** What it is for, one line. */
  description: string;
  effects: EffectSpec[];
}

/** The user's own presets, outside the project (`localStorage`, `cloudy-clip.sound-presets`). */
export interface UserPresets {
  presets: SoundPreset[];
}

/** The effects a transfer graph draws: level in against level out. */
export type TransferEffect = CompressorEffect | GateEffect;

/** What an effect's section tells the transfer graph while a value is dragged. */
export interface TransferGraphHandle {
  /** Draws the curve of these settings, without a React render. */
  draw(effect: TransferEffect): void;
}

/** Changes to the effects of one chain: drag steps reach the preview only, a release is one command. */
export interface EffectEdit {
  /** Plays the chain with this effect in place of the saved one, until the next commit. */
  live(effect: SoundEffect): void;
  /** Sends `sound.setEffect` with the fields that change, then stops playing the live chain. */
  commit(effectId: string, patch: Record<string, unknown>): Promise<void>;
  /** Sends `sound.removeEffect`. */
  remove(effectId: string): void;
}

/** A row of an effect chain dragged up or down. */
export interface ChainDrag {
  down: PointerEvent;
  /** The row being moved; it follows the pointer through `style`. */
  row: HTMLElement;
  /** The release, with the travel; null when the pointer never moved (a click). */
  onEnd(dy: number | null): void;
}
