import type { Micros } from "@/core";
import { dbToLinear, keyMoments, trackValue, type KeyTrack } from "@/modules/project";
import type { LinePoint } from "../preview.types";

/** How often the line is read between its keys, as the export samples it. */
const STEP: Micros = 100_000;
/** How long before a key the line is read too, so a Hold step stays a step, as in the export. */
const EDGE: Micros = 1_000;

/** A track's level at a timeline time: its volume line with the fader's offset on top, linear. */
export function lineLevel(line: KeyTrack, offsetDb: number, time: Micros): number {
  return dbToLinear(Number(trackValue(line, time)) + offsetDb);
}

/**
 * The levels to ramp the bus through, straight from one to the next, so it follows the line over
 * `from..to` (`from` left out, `to` kept): at each key (and 1 ms before it) and every 100 ms of
 * timeline time, the times the export reads it at, since a straight dB line is a curve in gain.
 */
export function lineSchedule(
  line: KeyTrack,
  offsetDb: number,
  from: Micros,
  to: Micros,
): LinePoint[] {
  const times = new Set<Micros>([to]);
  for (let at = (Math.floor(from / STEP) + 1) * STEP; at < to; at += STEP) times.add(at);
  for (const key of keyMoments(line, from, to)) {
    if (key > from) times.add(key);
    if (key - EDGE > from) times.add(key - EDGE);
  }
  return [...times]
    .filter((at) => at > from && at <= to)
    .sort((a, b) => a - b)
    .map((at) => ({ at, gain: lineLevel(line, offsetDb, at) }));
}
