import type { StoreApi } from "zustand/vanilla";
import type { Logger, Micros } from "@/core";
import type { MediaApi } from "@/modules/media";
import type { PreviewApi } from "@/modules/preview";
import type { CompositionId, EqBand, ProjectFormat, ProjectState } from "@/modules/project";

/** The part of a composition's timeline that gets exported. */
export interface ExportRange {
  start: Micros;
  duration: Micros;
}

/** A value at a moment of a segment; between two points it changes along a straight line. */
export interface EnvelopePoint {
  /** Counted from the segment's start in the export. */
  at: Micros;
  value: number;
}

/** One stretch of a file's sound on the export's clock (mirrors `SoundSegment` in Rust). */
export interface SoundSegment {
  path: string;
  /** Where it starts in the export. */
  at: Micros;
  /** Where it starts in the file. */
  from: Micros;
  duration: Micros;
  /** The top-level track it sounds through: an index into `SoundMix.tracks`. */
  track: number;
  fadeIn: Micros;
  fadeOut: Micros;
  /** Linear level, with the tracks inside a placed composition folded in. Missing is 1. */
  gain?: number;
  /** -1 (left) to 1 (right). Missing is centre. */
  pan?: number;
  /** Linear level over the segment, for a keyed volume. Replaces `gain`. */
  gainEnvelope?: EnvelopePoint[];
  /** Pan over the segment, for a keyed pan. Replaces `pan`. */
  panEnvelope?: EnvelopePoint[];
  /** The bands that change the sound. */
  eq?: EqFilter[];
  /** Shift in semitones, keeping the length. */
  pitch?: number;
  /** How fast it plays; `duration` is its length in the export. Missing is 1. */
  speed?: number;
  /** False when its pitch moves with its speed. Missing is true. */
  keepPitch?: boolean;
  /** Plays its part of the file backwards. */
  reversed?: boolean;
  /** A ramped clip's sound, as stretches of one tempo each. Replaces `speed`. */
  tempoSteps?: TempoStep[];
}

/** How a track mixes its clips: a level and a pan on their sum (mirrors `TrackMixSpec` in Rust). */
export interface TrackMixSpec {
  /** Linear level. */
  gain: number;
  /** -1 (left) to 1 (right). */
  pan: number;
}

/** How the tracks mix, then the master (mirrors `SoundMix` in Rust). Solo is never in it. */
export interface SoundMix {
  /** The composition's audio tracks in order; a segment's `track` indexes this. */
  tracks: TrackMixSpec[];
  master: { gain: number };
}

/** What sounds in an export: the stretches of files, and how the tracks they sit on mix. */
export interface Mixdown {
  segments: SoundSegment[];
  mix: SoundMix;
}

/** What a placed composition passes to the clips inside it (see `mixdown`). */
export interface MixNesting {
  /** The index of the top-level track the placement sits on. */
  track: number;
  /** The level the placement is heard at, before the inner tracks. */
  gain: number;
  /** The pan of the inner tracks above, summed. */
  pan: number;
}

/** A stretch of a ramped segment played at one tempo (mirrors `TempoStep` in Rust). */
export interface TempoStep {
  /** Where it starts in the file. */
  from: Micros;
  /** Its length in the export. */
  duration: Micros;
  /** How fast it plays: its part of the file over `duration`. */
  speed: number;
}

/** What a file holds (mirrors `Format` in Rust). */
export type ExportFormat = "h264" | "h265" | "webm" | "prores" | "gif" | "mp3";

/** A preset of the quality, or `custom`. */
export type ExportKind = "default" | "small" | "best" | "custom";

/** How long the encoder works on each frame (mirrors `Effort` in Rust). */
export type ExportEffort = "fast" | "balanced" | "small";

/** What to do when the file already exists. */
export type ExportIfExists = "number" | "replace" | "fail";

/** A file format offered on the page. */
export interface ExportFormatInfo {
  id: ExportFormat;
  label: string;
  extension: string;
  /** Whether frames are drawn. */
  picture: boolean;
  /** Whether the file can hold sound. */
  sound: boolean;
  /** Whether the quality setting changes anything. */
  quality: boolean;
  /** Picture size against H.264 at the same quality. */
  sizeFactor: number;
  /** Encoding time against H.264. */
  timeFactor: number;
}

/** What the FFmpeg on this machine can write (mirrors `Capabilities` in Rust). */
export interface ExportCapabilities {
  ffmpeg: boolean;
  formats: ExportFormat[];
  h264Card: string | null;
  h265Card: string | null;
}

/** One export, as the native side takes it (mirrors `ExportSpec` in Rust). */
export interface ExportSpec {
  output: string;
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  duration: Micros;
  crf: number;
  audioKbps: number;
  effort: ExportEffort;
  hardware: boolean;
  sound: SoundSegment[];
  mix: SoundMix;
}

/** Where an export is. */
export type ExportStatus =
  "waiting" | "preparing" | "rendering" | "finishing" | "done" | "failed" | "cancelled";

/** One export in the queue. */
export interface ExportJob {
  id: string;
  /** File name with its extension. */
  file: string;
  /** Full path of the file. */
  path: string;
  kindLabel: string;
  compositionId: CompositionId;
  status: ExportStatus;
  /** 0..1 of the current status. */
  progress: number;
  /** Why it failed, or what it is doing. */
  message?: string;
  estimatedBytes: number;
  /** Whether to show the file when it's done. */
  reveal: boolean;
  /** The native side's input, without the file's final name decided by the queue. */
  spec: ExportSpec;
  range: ExportRange;
  /** The document as it was when queued. */
  project: ProjectState;
}

/** The queue of one kernel. */
export interface ExportQueueState {
  jobs: ExportJob[];
}

/** The page's settings. View state: not in the project, not undoable. */
export interface ExportFormState {
  name: string;
  folder: string;
  /** Null: the composition that's open. */
  compositionId: CompositionId | null;
  kind: ExportKind;
  quality: number;
  format: ExportFormat;
  whole: boolean;
  /** Where "Only a part" starts and ends. */
  from: Micros;
  to: Micros;
  effort: ExportEffort;
  sound: boolean;
  hardware: boolean;
  ifExists: ExportIfExists | "ask";
  reveal: boolean;
}

/** A stretch of one composition's clock and where it lands on the export's clock. */
export interface MixWindow {
  from: Micros;
  to: Micros;
  /** Add to a time of this composition to get the export's time. */
  shift: Micros;
}

/** Fades a placement passes down to what starts or ends with it. */
export interface MixEdges {
  fadeIn: Micros;
  fadeOut: Micros;
}

/** What an export needs for its estimates. */
export interface EstimateInput {
  format: ProjectFormat;
  info: ExportFormatInfo;
  quality: number;
  duration: Micros;
  sound: boolean;
  effort: ExportEffort;
  hardware: boolean;
}

/** What the runner needs from the rest of the app. */
export interface RunnerDeps {
  queue: StoreApi<ExportQueueState>;
  preview: Pick<PreviewApi, "createRenderer" | "measureVideoLevels">;
  media: Pick<
    MediaApi,
    "prepareMaster" | "masterUrl" | "prepareReversed" | "reversedUrl" | "getProbe"
  >;
  log: Logger;
}

/** Runs the queue. */
export interface ExportRunner {
  /** Starts the queue, if it isn't running. */
  start(): void;
  /** Stops a job. Its partial file is removed. */
  cancel(id: string): Promise<void>;
  /** Stops whatever runs, when the module goes away. */
  dispose(): void;
}

/** The export module's API for one kernel. */
export interface ExportApi {
  /** Exports, oldest first. */
  readonly queue: StoreApi<ExportQueueState>;
  /** The page's settings. */
  readonly form: StoreApi<ExportFormState>;
  /** What can be exported here; null until known. */
  readonly capabilities: StoreApi<{ value: ExportCapabilities | null }>;
  readonly runner: ExportRunner;
}

/** One band of a clip's equalizer that changes the sound (mirrors `EqFilter` in Rust). */
export interface EqFilter {
  kind: EqBand["shape"];
  hz: number;
  db: number;
  q: number;
}
