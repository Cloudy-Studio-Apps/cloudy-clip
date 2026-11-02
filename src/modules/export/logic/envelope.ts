import type { Micros } from "@/core";
import type { EnvelopePoint } from "../export.types";

/** How often a value is sampled. */
const STEP: Micros = 100_000;
/** The most points one envelope has: each becomes text in an FFmpeg argument, which has a size limit. */
const MAX_POINTS = 256;
/** How far a point may sit off the straight line between its neighbours and still be dropped. */
const TOLERANCE = 0.001;

/**
 * A value that changes over a stretch, as points to draw straight lines between. Sampled every
 * 100 ms (coarser on a long stretch, so there are at most 256 points); a point on the line
 * between its neighbours, within 0.001, is dropped. `at` counts from `from`; the first and last
 * points are always kept.
 */
export function envelope(
  value: (time: Micros) => number,
  from: Micros,
  to: Micros,
): EnvelopePoint[] {
  const span = Math.max(0, to - from);
  const step = Math.max(STEP, Math.ceil(span / (MAX_POINTS - 1)));
  const samples: EnvelopePoint[] = [];
  for (let at = 0; at < span; at += step) samples.push({ at, value: value(from + at) });
  samples.push({ at: span, value: value(to) });

  const kept: EnvelopePoint[] = [samples[0]!];
  for (let i = 1; i < samples.length - 1; i++) {
    const a = kept[kept.length - 1]!;
    const here = samples[i]!;
    const b = samples[i + 1]!;
    const online = a.value + ((b.value - a.value) * (here.at - a.at)) / (b.at - a.at);
    if (Math.abs(here.value - online) > TOLERANCE) kept.push(here);
  }
  kept.push(samples[samples.length - 1]!);
  return kept;
}
