import type { Micros } from "@/core";

/** Greedy lanes for cues sorted by start: each takes the first lane whose last end is at or before its start. */
export function laneOf(cues: readonly { start: Micros; end: Micros }[]): number[] {
  const ends: Micros[] = [];
  return cues.map((cue) => {
    let lane = ends.findIndex((end) => end <= cue.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = cue.end;
    return lane;
  });
}
