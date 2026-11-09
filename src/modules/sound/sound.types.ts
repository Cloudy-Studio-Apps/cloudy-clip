import type { RefObject } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { CommandBus, Micros, PagesState } from "@/core";
import type {
  Clip,
  CompositionId,
  CompressorEffect,
  GateEffect,
  KeyTrack,
  ProjectState,
  SoundEffect,
  TrackId,
  BusId,
} from "@/modules/project";
import type { LoopRange, MonitorState, PreviewApi } from "@/modules/preview";
import type { MediaApi } from "@/modules/media";
import type { ProjectApi } from "@/modules/project";
import type { WorkspaceApi } from "@/modules/workspace";
import type { Analyzer, Matcher } from "./sound.delivery.types";

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
  /**
   * The mixer shows the strips of this group only (the group and the tracks sent to it), or every
   * strip when null or a group the open composition lacks. Master always shows.
   */
  filter: BusId | null;
  /** Mono, Dim and the speaker volume. Never in an export. */
  monitor: MonitorState;
  /** The track a recording goes onto: an audio track that isn't muted. */
  armed: TrackId | null;
  /** By `automationKey` (a track, or the master of a composition): how each fader writes its volume line while playing; missing is Read. */
  automation: Record<string, AutomationMode>;
  /** Tracks whose volume line is in front of their clips' lines: Draw volume draws on it. */
  lineView: Record<TrackId, boolean>;
  /** The pointer tool of the Sound page's lanes. */
  tool: SoundTool;
  /** The selected point of a track's volume line, or the master's (`"master"`): Delete removes it. */
  linePoint: { trackId: LineTarget; keyId: string } | null;
}

/**
 * How a track's fader writes its volume line while playing: Read plays the line only; Touch
 * writes while the fader is held and returns to the line on release; Latch writes from the first
 * touch until playback stops. View state, never in history.
 */
export type AutomationMode = "read" | "touch" | "latch";

/**
 * The pointer tool on the Sound page's lanes: Select (move, trim, fade handles), Cut (the blade),
 * Fade (drag a clip's edge), Draw volume, or Scrub.
 */
export type SoundTool = "select" | "cut" | "fade" | "draw" | "scrub";

/** A cut with the blade: one clip where it was clicked, or (Shift) every clip under that time. */
export interface BladeCut {
  bus: CommandBus;
  /** The audio clips of the open composition (the Sound page's scope). */
  clips: readonly Clip[];
  /** The clip clicked, or null over none. */
  hit: Clip | null;
  /** The cut time, snapped as a split is. */
  at: Micros;
  /** Shift: every clip under `at`, on every track. */
  every: boolean;
}

/** A fade dragged from a clip's edge on the Sound page's lanes. */
export interface FadeDrag {
  down: PointerEvent;
  bus: CommandBus;
  clip: Clip;
  /** The clip's box on screen. */
  box: DOMRect;
  pxPerSecond: number;
  /** Shows the fade's width over the clip with `style`, or hides it (null). */
  show(box: { left: number; width: number } | null): void;
}

/** A level written at a timeline time: a point of a stroke or of a fader pass. */
export interface LevelAt {
  /** Timeline time. */
  at: Micros;
  db: number;
}

/** One stretch of a fader pass: its points replace the line from `from` to `to`. */
export interface PassSpan {
  from: Micros;
  to: Micros;
  points: LevelAt[];
}

/** What the automation writer tells the page: the tracks (and the master) whose pass is being written. */
export interface AutomationState {
  writing: LineTarget[];
}

/**
 * Turns fader moves into a volume line while playing, per kernel: a track's, or the master's of
 * the open composition (`"master"`). In Touch, holding the
 * fader writes; in Latch, writing goes on after the release until playback stops. The fader is an
 * offset on the line: a pass writes the line raised or lowered by how far the fader moved. Each
 * pass is sent as one `sound.writePasses` when it ends (stop, a change of mode, leaving the page
 * or the composition, the project being left).
 */
export interface AutomationWriter {
  state: StoreApi<AutomationState>;
  /** The fader was pressed at `db`. True when the press writes the line (Touch or Latch, playing). */
  press(target: LineTarget, db: number): boolean;
  /**
   * The fader of a writing press moved to `db`: heard at once, written each frame. With its pass
   * ended (playback stopped under the hold) it's still heard, and writes again once playing.
   */
  move(target: LineTarget, db: number): void;
  /**
   * The fader of a writing press was let go: Touch returns to the line and stops writing until the
   * next press (its pass still sent once, at stop), Latch keeps writing.
   */
  release(target: LineTarget): void;
  /** The fader level a pass holds for the target, or null when none does (Touch let go). */
  level(target: LineTarget): number | null;
  /** Ends every pass, sending what each wrote. */
  finish(): Promise<void>;
  /**
   * Drops every pass, sending nothing, and stops following playback, the page and the project.
   * For the module's teardown: leaving the project sends them first (`beforeLeave`).
   */
  dispose(): void;
}

/** What the automation writer needs. */
export interface AutomationDeps {
  bus: CommandBus;
  preview: PreviewApi;
  project: ProjectApi;
  workspace: WorkspaceApi;
  pages: StoreApi<PagesState>;
  view: StoreApi<SoundViewState>;
}

/** A pass being written on one track or the master. */
export interface AutomationPass {
  mode: AutomationMode;
  /** The composition open when the pass began: the master's it writes. */
  compositionId: CompositionId | null;
  /** The fader volume when the pass began: the offset the line sits under. */
  offset: number;
  /** The fader level held now. */
  level: number;
  /** The fader is held. A Touch pass let go writes nothing until it's pressed again. */
  held: boolean;
  /**
   * The track's volume line when the pass began. Every lap writes relative to it, so a loop going
   * round never adds the pass to itself.
   */
  snapshot: KeyTrack | undefined;
  /**
   * The stretches written, one per lap (a seek or the loop going round starts the next), each in
   * time order; the last is being written. Sent together when the pass ends, a later lap winning
   * where they overlap.
   */
  laps: LevelAt[][];
  /** Some level written differs from the line: there is something to send. */
  changed: boolean;
}

/**
 * Feeds a fader the level heard now (dB), each frame it may change; returns what stops it. A track
 * with a volume line hears the line plus the fader's offset, which the handle alone doesn't show.
 */
export type HeardFeed = (draw: (db: number) => void) => () => void;

/** A stroke drawn over a lane with Draw volume, in screen coordinates. */
export interface StrokeDrag {
  down: PointerEvent;
  /** Every move, with the stroke so far. */
  onMove(points: readonly StrokePoint[]): void;
  /** The release with the stroke, or null on Escape or a cancel. */
  onEnd(points: readonly StrokePoint[] | null): void;
}

/** A point of a stroke, on screen. */
export interface StrokePoint {
  clientX: number;
  clientY: number;
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
  /** Shows the strips of one group in the mixer, or (null) every strip. */
  setFilter(busId: BusId | null): void;
  /** Arms a track for recording, or none. Refused (nothing changes) while a take is recorded. */
  arm(trackId: TrackId | null): void;
  /** Records the microphone onto the armed track, or onto a new Voice track when none is armed. */
  recorder: Recorder;
  /** Chooses the pointer tool of the lanes. */
  setTool(tool: SoundTool): void;
  /** Sets how a track's fader, or the master's (of `compositionId`, default the open one), writes its volume line while playing. */
  setAutomation(target: LineTarget, mode: AutomationMode, compositionId?: CompositionId): void;
  /** Puts a track's volume line in front of its clips' lines, or behind. */
  setLineView(trackId: TrackId, inFront: boolean): void;
  /** Writes fader passes onto volume lines. */
  automation: AutomationWriter;
  /** Whole-mix analyses: results, progress, start and cancel. */
  analyzer: Analyzer;
  /** Runs Match target outside the bus, and matches an export's mix (see `sound.startMatch`). */
  matcher: Matcher;
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
  /**
   * The track the take goes onto. Null while idle, and during a take onto a new Voice track until
   * it's placed (the track is made with the take, in its undo step).
   */
  trackId: TrackId | null;
  /** Where the take starts on the timeline. */
  at: Micros;
}

/** Records the microphone into a WAV beside the project and places it as a clip. One take at a time. */
export interface Recorder {
  state: StoreApi<RecorderState>;
  /**
   * Opens the microphone, starts playback and records onto `trackId`, or with `null` onto a new
   * Voice track at the bottom of the open composition (made when the take is placed, then armed).
   * Tells the user when it can't.
   */
  start(trackId: TrackId | null): Promise<void>;
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
  preview: PreviewApi;
  project: ProjectApi;
  media: MediaApi;
  workspace: WorkspaceApi;
  /** The Sound page's view: `armed` lives there. */
  view: StoreApi<SoundViewState>;
}

/** A take as the recorder keeps it. */
export interface LiveTake {
  /** Null: onto a new Voice track, made when the take is placed. */
  trackId: TrackId | null;
  at: Micros;
  /** Samples are kept (after playback started) until the take stops. */
  keeping: boolean;
  /** Stop was asked for. While still starting, `start` closes the take itself. */
  ending: boolean;
  /** The stop under way: finishing the file and placing it. */
  finishing: Promise<void> | null;
  /** The composition recorded in. */
  compositionId: CompositionId;
  /** The loop set when the take started: off while it records, set again after. */
  loop: LoopRange | null;
  /** Lets audio scrub sound again (silenced while the microphone is open). */
  releaseScrub: () => void;
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

/** A track or group that owns a chain, as `checkDuck` reads it. */
export interface DuckOwner {
  id: TrackId | BusId;
  name: string;
  compositionId: CompositionId;
}

/** The tracks that listen through ducks or send to groups, as `closesLoop` reads them. */
export type ListenNodes = Record<TrackId, { mix?: { busId?: BusId; effects?: SoundEffect[] } }>;

/** What a mixer strip addresses: an audio track, a group (its `BusId`), or the master. */
export type MixTarget = TrackId | BusId | "master";

/** What has a volume line: an audio track, or the master of a composition. */
export type LineTarget = TrackId | "master";

/** A volume line found for a command (`lineOwner`): the line, how close two keys merge, and how to write it. */
export interface LineOwner {
  line: KeyTrack | undefined;
  /** Half a frame of its composition, in µs. */
  tolerance: Micros;
  /** Stores `line` on the owner in `draft`, or removes it when it has no keys. */
  write(draft: ProjectState, line: KeyTrack | undefined): void;
}

/** Where a chain command acts: a track, or the master or a group of `compositionId` (default: the open one). */
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
  /** The press, before any move. */
  onPress?(): void;
  /** The release of a press, before the commit. */
  onRelease?(): void;
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
export type SoundPanelTab = "clip" | "channel" | "loudness" | "deliver";

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
  /** The delivery target and the spectrum's fill: the theme's `--on`. */
  on: string;
}

/** What the Loudness tab tells its stereo phase meter. */
export interface PhaseMeterHandle {
  /** Shows a reading's correlation (`null`, or one before anything was measured, shows `—`). */
  show(correlation: number | null): void;
}

/** How a whole-mix analysis stands against the delivery target (`verdictOf`). */
export interface DeliveryVerdict {
  /** Integrated loudness minus the target, LU; null for a silent mix. */
  loudnessDiff: number | null;
  /** Peak limit minus the true peak, dB: negative when over; null for digital silence. */
  peakMargin: number | null;
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

/**
 * A control of the Sound page that a later stage makes work: one entry of `ui/soon/soon.catalog.ts`.
 * Each stage removes its own ids as it builds them.
 */
export type SoonId =
  | "transport.findBeats"
  | "transport.stripSilence"
  | "transport.matchLevel"
  | "compressor.reduction";

/** A placeholder: what it will be and the stage that builds it. */
export interface SoonEntry {
  id: SoonId;
  /** Its name, as the tooltip starts. */
  label: string;
  /** What it will do, one sentence. */
  what: string;
  /** The stage plan that builds it: `docs/superpowers/plans/2026-11-03-sound-<stage>-*.md`. */
  stage: "2-followup" | 3 | 6;
}

/** The props a placeholder spreads: dimmed for screen readers, its tooltip, an arrow pointer, a click that does nothing. */
export interface SoonProps {
  "aria-disabled": true;
  title: string;
  className: string;
  onClick(): void;
}

/** A point of a clip's volume line: `x` in px from the clip's left edge, `db` the level. */
export interface LinePoint {
  x: number;
  db: number;
}

/** A key of the clip's volume line, drawn at `x`. */
export interface LineKey extends LinePoint {
  keyId: string;
}

/** Dragging a point of a clip's volume line. */
export interface LineDrag {
  down: PointerEvent;
  /** The box the line is drawn in: its height is the whole level range. */
  area: HTMLElement;
  /** Where the point is when the drag starts. */
  from: LinePoint;
  /** The clip's width in px: a point stays inside it. */
  width: number;
  /** Every move, with the point's new place. */
  onMove(point: LinePoint): void;
  /** The release, with the last place; null when the pointer never moved, or Escape. */
  onEnd(point: LinePoint | null): void;
}

/** What a finished stroke needs to be written. */
export interface StrokeTarget {
  bus: CommandBus;
  state: ProjectState;
  /** A track, or "master" (always in front). */
  target: LineTarget;
  /** The track's line is in front: the stroke writes it; otherwise the clip under its start. */
  inFront: boolean;
  /** The track line's box on screen; its left edge is the timeline's start. */
  box: DOMRect;
  /** The timeline's content, where the clips' line boxes are found. */
  content: HTMLElement;
  pxPerSecond: number;
}
