import type { StoreApi } from "zustand/vanilla";
import type { Micros } from "@/core";
import type { Clip, ClipId, CompositionId, ProjectState } from "@/modules/project";

/** The open Strip silence dialog. */
export interface SilenceDialog {
  /** The clips it is about. */
  clipIds: ClipId[];
  /** Cut sound only, leave gaps (the Sound page); otherwise picture and sound, gaps closed. */
  soundOnly: boolean;
  /** What it would cut, in timeline time: drawn in the marks row (Sound page) or ruler (Edit). */
  cuts: Cut[];
}

/** A stretch of the timeline Strip silence takes out. */
export interface Cut {
  start: Micros;
  end: Micros;
}

/** The cuts of one clip. */
export interface ClipCuts {
  clipId: ClipId;
  cuts: Cut[];
  /** The file has no sound: nothing was scanned. */
  noSound?: true;
}

/** What counts as silence, and what is kept around the sound. */
export interface SilenceParams {
  /** Quieter than this (dBFS) is silent. */
  thresholdDb: number;
  /** A silence shorter than this (ms) is kept. */
  minMs: number;
  /** Quiet kept on each side of a cut (ms). */
  padMs: number;
}

/**
 * Scans clips for silence outside the bus (a long file outlasts its timeout), at most two files at
 * a time, and keeps what it found for the command that strips it.
 */
export interface SilenceFinder {
  /**
   * Scans the clips that have sound of their own (what is kept isn't scanned again, what is under
   * way is joined) and returns their cuts in timeline time; `onProgress` gets 0 to 1 over all of
   * them. Rejects with message "Cancelled" when `signal` aborts, or with the native error.
   */
  scan(
    clipIds: readonly ClipId[],
    params: SilenceParams,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<ClipCuts[]>;
  /** The cuts of an earlier scan with these clips and values, or null when one is missing. */
  kept(clipIds: readonly ClipId[], params: SilenceParams): ClipCuts[] | null;
  /** Stops every scan under way (the kernel is going); a run stops by its own signal. */
  cancelAll(): void;
  /** Forgets what was found (the files may have changed). */
  forget(): void;
}

/** What was measured of one clip's sound. */
export interface ClipLoudness {
  /** The clip that carries the sound (a picture clip is measured through its linked sound). */
  clipId: ClipId;
  /** Integrated loudness (LUFS) of the part of its file the clip plays as heard through its own volume (static or keyed), before fades, EQ and track; null when silent. */
  lufs: number | null;
  /** The clip has no sound of its own to measure (no sound stream, text, a held frame, a nested composition). */
  noSound?: true;
}

/** Measures the loudness of clips outside the bus, two files at a time, and keeps it for Match level. */
export interface LoudnessMeter {
  /**
   * Measures the clips' sound (what is kept isn't measured again, what is under way is joined);
   * `onProgress` gets 0 to 1. Rejects with "Cancelled" when `signal` aborts, or the native error.
   */
  measure(
    clipIds: readonly ClipId[],
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<ClipLoudness[]>;
  /** The loudness of an earlier measurement of these clips, or null when one is missing. */
  kept(clipIds: readonly ClipId[]): ClipLoudness[] | null;
  /** Stops every measurement under way (the kernel is going); a run stops by its own signal. */
  cancelAll(): void;
  /** Forgets what was measured (the files may have changed). */
  forget(): void;
}

/** What Match level will do to one clip. */
export interface LevelChange {
  clipId: ClipId;
  /** Its measured loudness (LUFS). */
  lufs: number;
  /** The change (dB): the target minus its loudness, added to its volume (or every key). */
  deltaDb: number;
  /** Its new volume (dB) when it has none keyed; null when its volume keys shift instead. */
  volumeDb: number | null;
  /** The new value (or a key's) would pass the volume range and stops at its edge. */
  clamped: boolean;
}

/** What Match level would do: shown before it is applied. */
export interface LevelPlan {
  /** The loudness every clip is brought to (LUFS). */
  target: number | null;
  changes: LevelChange[];
  /** Clips left alone, and why. */
  skipped: { clipId: ClipId; reason: string }[];
}

/** The open Match level dialog: the clips it is about; null when closed. */
export interface MatchDialog {
  clipIds: ClipId[];
}

/** Beats found per file, and the find under way. View state of the kernel, never in history. */
export interface BeatsState {
  /** Beats by file path, in file microseconds; an empty list for a file with no tempo. */
  files: Record<string, Micros[]>;
  /** The find running: its progress 0 to 1 over all its files; null when none runs. */
  running: { progress: number } | null;
  /** Why the last find failed on a file, or null. */
  failed: string | null;
}

/** Finds beats in files one after another, outside the bus (a long file outlasts its timeout). */
export interface BeatFinder {
  state: StoreApi<BeatsState>;
  /** Starts finding the beats of `paths`; false when a find already runs. */
  find(paths: string[]): boolean;
  /** Stops the find running; files done so far keep their beats. */
  cancel(): void;
  /** Resolves when the find running (or the last one) ends. */
  settled(): Promise<void>;
  /**
   * The beats under `compositionId`'s audio clips in timeline time, remembered while the document
   * and the beats found are the same, so the ticks and snapping share one scan.
   */
  times(state: ProjectState, compositionId: CompositionId): Micros[];
}

/** One part of a file to measure, and the key its result is kept under (it names everything the result depends on). */
export interface ScanPart {
  key: string;
  path: string;
  from: Micros;
  to: Micros;
}

/** How a kind of measurement reaches FFmpeg: begin (null when the file has no sound), finish, cancel. */
export interface ScanIo<P extends ScanPart, R> {
  begin(part: P, onProgress: (progress: number) => void): Promise<string | null>;
  finish(jobId: string): Promise<R>;
  cancel(jobId: string): Promise<void>;
  /** What a file with no sound gives. */
  empty: R;
}

/** A part being measured: its job once begun, the runs waiting for it, and its progress. */
export interface ScanFlight<R> {
  done: Promise<R>;
  jobId: string | null;
  /** Runs still waiting for it; the last one to leave stops it. */
  waiters: number;
  cancelled: boolean;
  progress: number;
  listeners: Set<(progress: number) => void>;
}

/** What one clip is scanned for silence: its file and the part of it the clip plays. */
export interface SilencePart extends ScanPart {
  clip: Clip;
  params: SilenceParams;
}

/** What a clip is measured as: its part of the file, and the volume it plays through. */
export interface LoudPart extends ScanPart {
  gain: number;
  gainEnvelope: { at: Micros; value: number }[];
}

/** The scans an agent started (silences, loudness), by its key, so it can stop its own. */
export interface AgentScans {
  /** The signal the caller's scans run under (a fresh one after `cancel`). */
  signalOf(caller: string): AbortSignal;
  /** Stops the caller's scans; others' (and the dialogs') go on. */
  cancel(caller: string): void;
}
