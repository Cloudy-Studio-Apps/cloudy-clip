import type { Micros } from "@/core";
import { simplify } from "@/modules/project";
import type { EnvelopePoint } from "../export.types";

/** How often a value is sampled between its keys. */
const STEP: Micros = 100_000;
/** How long before a break the value is read too, so a jump stays one; FFmpeg's expressions keep
 * time to 10 µs, so it is longer than that. */
const EDGE: Micros = 1_000;
/** How far a point may sit off the straight line between its neighbours and still be dropped. */
const TOLERANCE = 0.001;

/**
 * A value that changes over a stretch, as points to draw straight lines between. Sampled at each
 * time in `breaks` (timeline times, and 1 ms before each, so a Hold step stays a step) and every
 * 100 ms; a point on the line between its neighbours, within 0.001, is dropped. There is no cap,
 * so no key is lost on a long stretch. `at` counts from `from`; the first and last points are
 * always kept, and so is every break that bends the line.
 */
export function envelope(
  value: (time: Micros) => number,
  from: Micros,
  to: Micros,
  breaks: readonly Micros[] = [],
): EnvelopePoint[] {
  const span = Math.max(0, to - from);
  const times = new Set<Micros>();
  for (let at = 0; at < span; at += STEP) times.add(at);
  times.add(span);
  for (const time of breaks) {
    const at = time - from;
    if (at > 0 && at < span) times.add(Math.max(0, at - EDGE)).add(at);
  }
  const samples = [...times].sort((a, b) => a - b).map((at) => ({ at, value: value(from + at) }));
  return simplify(samples, TOLERANCE);
}
