import type { SoundOnlySpec } from "@/modules/export";
import { beginAnalysis, cancelAnalysis, finishAnalysis } from "./sound.service";
import type { MixAnalysis } from "./sound.types";

/**
 * Measures a mix once, on the side: nothing is stored (Match target's correcting pass, and an
 * export's). Rejects with "Cancelled" when `signal` aborts, and as an analysis does otherwise.
 */
export async function measureOnce(
  spec: SoundOnlySpec,
  peakDbtp: number,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<MixAnalysis> {
  if (signal.aborted) throw new Error("Cancelled");
  const jobId = await beginAnalysis(spec, peakDbtp, onProgress);
  const stop = () => void cancelAnalysis(jobId).catch(() => undefined);
  if (signal.aborted) stop();
  signal.addEventListener("abort", stop);
  try {
    return await finishAnalysis(jobId);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}
