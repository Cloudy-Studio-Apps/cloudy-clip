import type { PeakHold } from "../sound.types";

/** The bottom of a meter, in dBFS: anything quieter shows nothing. */
export const METER_FLOOR_DB = -60;

/** How long a peak hold line stays before it falls to the level, in ms. */
export const PEAK_HOLD_MS = 1500;

/** Where the colour changes from `--on` to `--foreground`, in dBFS. */
export const METER_LOUD_DB = -6;

/** Where the colour changes from `--foreground` to `--mark`, in dBFS. */
export const METER_HOT_DB = -1;

/** How full a meter is at a level: 0 at −60 dBFS and below (and silence), 1 at 0 dBFS and above. */
export function meterHeight(db: number): number {
  if (!(db > METER_FLOOR_DB)) return 0;
  return Math.min(1, (db - METER_FLOOR_DB) / -METER_FLOOR_DB);
}

/**
 * The peak to show after a new level `now` at time `at` (ms): the new level when it is as loud or
 * the held one is older than `PEAK_HOLD_MS`, else the held one.
 */
export function holdPeak(previous: PeakHold | null, now: number, at: number): PeakHold {
  if (!previous || now >= previous.db || at - previous.at > PEAK_HOLD_MS) return { db: now, at };
  return previous;
}
