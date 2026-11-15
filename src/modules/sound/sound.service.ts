import { Channel, invoke } from "@tauri-apps/api/core";
import type { Micros } from "@/core";
import type { SoundOnlySpec } from "@/modules/export";
import type { MediaId } from "@/modules/project";
import type { TakeStarted, TakeWritten } from "./sound.types";
import type { MixAnalysis } from "./sound.delivery.types";

/**
 * The noise floor of `from..to` of a file's sound (file time), in dBFS, rounded and within what
 * noise reduction accepts (-80 to -20). Rejects if it can't be measured.
 */
export function measureNoiseFloor(id: MediaId, from: Micros, to: Micros): Promise<number> {
  return invoke<number>("sound_measure_floor", { id, from, to });
}

/**
 * Starts a take's WAV (16-bit mono at `sampleRate`) in `projectDir`, or in the app's cache when the
 * project has no folder yet: `stem.wav`, or `stem 2.wav`... when taken; never overwrites.
 */
export function beginTake(
  projectDir: string | null,
  stem: string,
  sampleRate: number,
): Promise<TakeStarted> {
  return invoke<TakeStarted>("sound_record_begin", { projectDir, stem, sampleRate });
}

/**
 * Appends 16-bit samples to a take; the file is a whole WAV after every write. `done` closes it
 * (a take with no samples is deleted).
 */
export function writeTake(id: string, samples: Uint8Array, done: boolean): Promise<TakeWritten> {
  return invoke<TakeWritten>("sound_record_write", samples, {
    headers: { id, done: done ? "1" : "0" },
  });
}

/**
 * Starts measuring a whole mix without playing it. `onProgress` gets 0 to 1. Returns the job's id,
 * for `finishAnalysis` and `cancelAnalysis`. Rejects if the mix has no sound.
 */
export function beginAnalysis(
  spec: SoundOnlySpec,
  peakLimit: number,
  onProgress: (progress: number) => void,
): Promise<string> {
  const channel = new Channel<number>();
  channel.onmessage = onProgress;
  return invoke<string>("sound_analyze_begin", { spec, peakLimit, onProgress: channel });
}

/** Waits for an analysis and returns its figures. Rejects with message "Cancelled" when it was stopped. */
export function finishAnalysis(jobId: string): Promise<MixAnalysis> {
  return invoke<MixAnalysis>("sound_analyze_finish", { jobId });
}

/** Stops an analysis. */
export function cancelAnalysis(jobId: string): Promise<void> {
  return invoke<void>("sound_analyze_cancel", { jobId });
}

/**
 * The beats of the file at `path`, in file microseconds (none for a file with no tempo), from the
 * native cache when the file is unchanged. `jobId` (letters, digits, `-`, `_`) is for
 * `cancelFileBeats`; `onProgress` gets 0 to 1. Rejects with message "Cancelled" when it was stopped.
 */
export async function findFileBeats(
  path: string,
  jobId: string,
  onProgress: (progress: number) => void,
): Promise<Micros[]> {
  const channel = new Channel<number>();
  channel.onmessage = onProgress;
  const found = await invoke<{ beats: Micros[] }>("sound_beats", {
    path,
    jobId,
    onProgress: channel,
  });
  return found.beats;
}

/** Stops a `findFileBeats` still decoding. */
export function cancelFileBeats(jobId: string): Promise<void> {
  return invoke<void>("sound_beats_cancel", { jobId });
}

/**
 * Starts looking for the silent stretches of `from..to` of the file at `path` (file microseconds):
 * FFmpeg's `silencedetect`, quieter than `thresholdDb` for at least `minMs`. `onProgress` gets 0 to
 * 1. Resolves with the scan's id for `finishSilences` and `cancelSilences`, or null when the file
 * has no sound.
 */
export function beginSilences(
  path: string,
  from: Micros,
  to: Micros,
  thresholdDb: number,
  minMs: number,
  onProgress: (progress: number) => void,
): Promise<string | null> {
  const channel = new Channel<number>();
  channel.onmessage = onProgress;
  return invoke<string | null>("sound_silences_begin", {
    path,
    from,
    to,
    thresholdDb,
    minMs,
    onProgress: channel,
  });
}

/** Waits for a scan to end: its stretches (file microseconds). Rejects with message "Cancelled" when it was stopped. */
export async function finishSilences(jobId: string): Promise<[Micros, Micros][]> {
  const found = await invoke<{ stretches: [Micros, Micros][] }>("sound_silences_finish", {
    jobId,
  });
  return found.stretches;
}

/** Stops a scan. */
export function cancelSilences(jobId: string): Promise<void> {
  return invoke<void>("sound_silences_cancel", { jobId });
}
