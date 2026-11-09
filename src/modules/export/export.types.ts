import type { StoreApi } from "zustand/vanilla";
import type { Logger, Micros } from "@/core";
import type { MediaApi } from "@/modules/media";
import type { PreviewApi } from "@/modules/preview";
import type {
  CompositionId,
  CompressorParams,
  DeesserEffect,
  DenoiseEffect,
  DuckEffect,
  EqBand,
  GateEffect,
  LimiterEffect,
  MediaAsset,
  ProjectFormat,
  ProjectState,
} from "@/modules/project";

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

/**
 * An effect that works, as the export applies it (mirrors `MixEffect` in Rust): the document's
 * `SoundEffect` without its id and switch, the EQ as the bands that change the sound, and a
 * duck's tracks as indexes into `SoundMix.tracks` and its groups as indexes into
 * `SoundMix.buses` (`listensToBuses`, missing when none). Noise reduction isn't one: it plays a file.
 */
export type MixEffect =
  | { kind: "eq"; bands: EqFilter[] }
  | { kind: "compressor"; params: CompressorParams }
  | Pick<GateEffect, "kind" | "thresholdDb" | "ratio" | "attackMs" | "releaseMs">
  | Pick<DeesserEffect, "kind" | "frequencyHz" | "amount">
  | Pick<LimiterEffect, "kind" | "ceilingDb" | "releaseMs">
  | (Pick<DuckEffect, "kind" | "depthDb" | "attackMs" | "releaseMs"> & {
      listensTo: number[];
      listensToBuses?: number[];
    });

/** How a track mixes its clips: effects, a pan and a level on their sum (mirrors `TrackMixSpec` in Rust). */
export interface TrackMixSpec {
  /** Linear level. */
  gain: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** Before the pan and the level, in order. Missing when none works. */
  effects?: MixEffect[];
  /**
   * The level over the export when the track has a volume line: the line with the fader's offset
   * on top, linear, `at` counted from the export's start. Replaces `gain`.
   */
  gainEnvelope?: EnvelopePoint[];
  /** The group it sends to, an index into `SoundMix.buses`; missing means the master. */
  bus?: number;
}

/**
 * A group track: the tracks sent to it summed, its effects, then its level, into the master
 * (mirrors `BusMixSpec` in Rust). A muted one adds nothing and keys no duck.
 */
export interface BusMixSpec {
  /** Linear level. */
  gain: number;
  /** Missing is false. */
  muted?: boolean;
  /** Before the level, in order. Missing when none works. */
  effects?: MixEffect[];
}

/** How the tracks mix, then the groups, then the master (mirrors `SoundMix` in Rust). Solo is never in it. */
export interface SoundMix {
  /** The composition's audio tracks in order; a segment's `track` indexes this. */
  tracks: TrackMixSpec[];
  /** The composition's groups in order; a track's `bus` indexes this. */
  buses: BusMixSpec[];
  /** Its level, its pan, then its effects. */
  master: MasterMixSpec;
}

/** The master (mirrors `MasterMixSpec` in Rust): the sum of the tracks and groups, then these, in order. */
export interface MasterMixSpec {
  /** Linear level; 0 when the master is muted. */
  gain: number;
  /**
   * The level over the export when the master has a volume line, as a track's (`TrackMixSpec`).
   * Replaces `gain`; missing when muted.
   */
  gainEnvelope?: EnvelopePoint[];
  /** -1 (left) to 1 (right), a balance with a track pan's law. Missing means centred. */
  pan?: number;
  /** After the level and the pan, in order. Missing when none works. */
  effects?: MixEffect[];
  /** What matching the delivery target adds for this one export or analysis (see `withCorrection`). */
  correction?: MasterCorrection;
}

/**
 * What matching a delivery target adds to the master of one export or analysis, never written to
 * the project (mirrors `MasterCorrection` in Rust): a level on top of the master's own (its line,
 * or its fader), and a limiter after its effects, for a master that has none working.
 */
export interface MasterCorrection {
  /** Added to the master's level, -72 to 72 dB. */
  gainDb: number;
  /** Missing when the master has a limiter of its own that works. */
  limiter?: Pick<LimiterEffect, "ceilingDb" | "releaseMs">;
}

/** What a loudness matcher is asked: one mix, and the document it comes from. */
export interface MatchRequest {
  /** The document the mix was built from (a queued export's own copy). */
  project: ProjectState;
  compositionId: CompositionId;
  /** The mix to match: a Mix export's sound, never its stems. */
  spec: SoundOnlySpec;
  /** 0 to 1 over every pass. */
  onProgress(progress: number): void;
  /** Aborted when the export is cancelled: the matcher stops and rejects. */
  signal: AbortSignal;
}

/**
 * Measures a mix and works out the correction that brings it to its composition's delivery target
 * (`sound` contributes the one, to `loudnessMatchers`). Rejects with a message a person can read
 * when it can't (a silent mix), or when `signal` aborts.
 */
export interface LoudnessMatcher {
  id: string;
  match(request: MatchRequest): Promise<MasterCorrection>;
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
  /** The noise reduction of that track (or its master), which the clips inside get. */
  denoise: DenoiseEffect | undefined;
  /** The volume lines of the inner tracks above; none when they have no line. */
  swell: Swell | undefined;
}

/** A level that changes over the export: the volume lines of the inner tracks around a clip. */
export interface Swell {
  /** The factor at a time on the export's clock. */
  gain(time: Micros): number;
  /** Times on the export's clock where it bends: the lines' keys. */
  breaks: Micros[];
}

/**
 * The file a clip's sound is mixed from: the file itself, or the one rendered with `denoise`, the
 * noise reduction it's heard through.
 */
export type SoundFile = (asset: MediaAsset, denoise: DenoiseEffect | undefined) => string;

/** A clip's gain and pan once the tracks around it are folded in (see `mixdown`). */
export interface Placed {
  gain: number;
  pan: number;
}

/** Folds the tracks around a clip into its gain and pan. */
export type Place = (gain: number, pan: number) => Placed;

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
export type ExportFormat =
  "h264" | "h265" | "webm" | "prores" | "gif" | "mp3" | "wav" | "flac" | "aac" | "opus";

/** Sample rates a sound-only file is written at (Opus is always 48000). */
export type ExportSampleRate = 44100 | 48000;

/** Bits per sample of WAV and FLAC. */
export type ExportBitDepth = 16 | 24;

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
  /** The name alone, for narrow places. */
  short: string;
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
  /** Rate of a sound-only file; a format with a picture is at 48000. */
  sampleRate: ExportSampleRate;
  /** WAV and FLAC only; 16 when not given. */
  bitDepth?: ExportBitDepth;
  effort: ExportEffort;
  hardware: boolean;
  sound: SoundSegment[];
  mix: SoundMix;
  /** Files written besides `output` (the mix) by the same FFmpeg; sound-only formats only. */
  stems?: StemSpec[];
}

/** The sound of an export without a file: what an analysis measures (mirrors `SoundOnlySpec` in Rust). */
export interface SoundOnlySpec {
  duration: Micros;
  sound: SoundSegment[];
  mix: SoundMix;
}

/**
 * A stem file (mirrors `StemSpec` in Rust): what one group sends to Master, or, without `bus`,
 * what the tracks sent straight to Master do ("Other"), taken before Master's level and effects.
 */
export interface StemSpec {
  output: string;
  /** The group, an index into `SoundMix.buses`. */
  bus?: number;
}

/** A stem a composition exports (see `stemsOf`). */
export interface StemPlan {
  /** What its file is named with: `<name> - <label>.<ext>`. Safe in a file name, and unique. */
  label: string;
  /** The group, an index into `SoundMix.buses`; missing for "Other". */
  bus?: number;
}

/** Where an export is. */
export type ExportStatus =
  | "waiting"
  | "preparing"
  | "measuring"
  | "rendering"
  | "finishing"
  | "done"
  | "failed"
  | "cancelled";

/** One export in the queue. */
export interface ExportJob {
  id: string;
  /** File name with its extension. */
  file: string;
  /** Full path of the file: the mix, when it has stems. */
  path: string;
  /** Full paths of its stem files, when it has some. */
  stems?: string[];
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
  /**
   * Whether the runner measures the mix first and brings it to the delivery target, in its own
   * spec only (`MasterMixSpec.correction`); the project is never changed. Missing is false.
   */
  matchTarget?: boolean;
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
  /** Of a sound-only file. */
  sampleRate: ExportSampleRate;
  /** Of a WAV or FLAC file. */
  bitDepth: ExportBitDepth;
  whole: boolean;
  /** Where "Only a part" starts and ends. */
  from: Micros;
  to: Micros;
  effort: ExportEffort;
  sound: boolean;
  /** Each group, and Other, as files of their own beside the mix (sound-only formats). */
  stems: boolean;
  /** Bring the mix to the delivery target in the file, without changing the project. */
  matchTarget: boolean;
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
  sampleRate?: ExportSampleRate;
  bitDepth?: ExportBitDepth;
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
  /** What matches a mix to its target, when a module contributes one. Read at run time. */
  matcher(): LoudnessMatcher | undefined;
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
  /** Whether a module matches mixes to their delivery target (`sound` does): `matchTarget` needs one. */
  canMatchTarget(): boolean;
}

/** One band of a clip's equalizer that changes the sound (mirrors `EqFilter` in Rust). */
export interface EqFilter {
  kind: EqBand["shape"];
  hz: number;
  db: number;
  q: number;
}
