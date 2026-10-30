import type { DriftState } from "../preview.types";

/** While playing, a media element further than this from the clock is re-seeked. */
export const MAX_DRIFT_SECONDS = 0.08;
/** After a seek while playing, give the element this long to catch up before seeking again. */
const SEEK_GRACE_MS = 500;
/** Drift tolerated during that grace. */
const GRACE_DRIFT_SECONDS = 0.5;
/** A seek's cost before one has been measured. */
export const INITIAL_SEEK_COST = 0.2;
/** Most a seek aims ahead of the clock. */
export const MAX_SEEK_AHEAD = 0.6;

/**
 * Where to seek a playing element, or `null` to leave it alone. The clock keeps moving during a
 * seek, so a seek to the clock lands behind it by the time the seek took, and on long-GOP files
 * that is over the limit: the next seek lands late again, and each one flushes the sound (an
 * audible tick every `SEEK_GRACE_MS`). So a seek aims where the clock will be when it lands.
 */
export function driftSeek(state: DriftState): number | null {
  const { current, desired, duration, seekTarget, sinceSeekMs, seekCost } = state;
  const limit = sinceSeekMs < SEEK_GRACE_MS ? GRACE_DRIFT_SECONDS : MAX_DRIFT_SECONDS;
  if (Math.abs(current - desired) <= limit) return null;
  const pending =
    seekTarget !== null &&
    seekTarget > desired - MAX_DRIFT_SECONDS &&
    seekTarget < desired + MAX_SEEK_AHEAD + MAX_DRIFT_SECONDS;
  if (pending) return null;
  const target = desired + Math.min(seekCost, MAX_SEEK_AHEAD);
  return target < duration ? target : desired;
}
