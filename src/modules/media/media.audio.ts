import type { MediaProbe } from "./media.types";

/**
 * Whether a file has sound. Assumed true unless ffprobe found no sound stream (without FFmpeg
 * it can't be known, and a missing audio clip is worse than a silent one).
 */
export function mediaHasAudio(probe: MediaProbe | undefined): boolean {
  return probe?.proxy?.hasAudio !== false;
}
