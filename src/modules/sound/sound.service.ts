import { Channel, invoke } from "@tauri-apps/api/core";
import type { Micros } from "@/core";
import type { SoundOnlySpec } from "@/modules/export";
import type { MediaId } from "@/modules/project";
import type { MixAnalysis, TakeStarted, TakeWritten } from "./sound.types";

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
