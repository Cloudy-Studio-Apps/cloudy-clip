import type { Micros } from "@/core";
import { dbToLinear, keyMoments, trackValue } from "@/modules/project";
import type { LineAt, LinePoint } from "../preview.types";

/** How often the lines are read between their keys, as the export samples them. */
const STEP: Micros = 100_000;
/** How long before a key the lines are read too, so a Hold step stays a step, as in the export. */
const EDGE: Micros = 1_000;

/**
 * A level at a playhead time: the volume lines (each read on its own composition's clock) added
 * in dB, with `offsetDb` on top, linear.
 */
export function lineLevel(lines: readonly LineAt[], offsetDb: number, time: Micros): number {
  const db = lines.reduce(
    (sum, { line, shift }) => sum + Number(trackValue(line, time + shift)),
    0,
  );
  return dbToLinear(db + offsetDb);
}

/**
 * The levels to ramp through, straight from one to the next, so a gain follows the lines over
 * `from..to` of the playhead (`from` left out, `to` kept): at each key (and 1 ms before it) and
 * every 100 ms, the times the export reads them at, since a straight dB line is a curve in gain.
 */
export function lineSchedule(
  lines: readonly LineAt[],
  offsetDb: number,
  from: Micros,
  to: Micros,
): LinePoint[] {
  const times = new Set<Micros>([to]);
  for (let at = (Math.floor(from / STEP) + 1) * STEP; at < to; at += STEP) times.add(at);
  for (const { line, shift } of lines) {
    for (const moment of keyMoments(line, from + shift, to + shift)) {
      const key = moment - shift;
      if (key > from) times.add(key);
      if (key - EDGE > from) times.add(key - EDGE);
    }
  }
  return [...times]
    .filter((at) => at > from && at <= to)
    .sort((a, b) => a - b)
    .map((at) => ({ at, gain: lineLevel(lines, offsetDb, at) }));
}

/** Whether two sets of lines are the same lines on the same clocks. */
export function sameLines(a: readonly LineAt[], b: readonly LineAt[]): boolean {
  return (
    a.length === b.length && a.every((at, i) => at.line === b[i]!.line && at.shift === b[i]!.shift)
  );
}
