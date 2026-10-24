import { MICROS_PER_SECOND, type Micros } from "@/core";

/** Converts a timeline time to a horizontal pixel offset at the given zoom. */
export function timeToPx(time: Micros, pxPerSecond: number): number {
  return (time / MICROS_PER_SECOND) * pxPerSecond;
}

/** Converts a horizontal pixel offset to a timeline time at the given zoom. */
export function pxToTime(px: number, pxPerSecond: number): Micros {
  return Math.round((px / pxPerSecond) * MICROS_PER_SECOND);
}

/** Picks a "nice" ruler step (in seconds) so labels stay at least `minLabelPx` apart. */
export function rulerStep(pxPerSecond: number, minLabelPx = 80): number {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  for (const step of steps) if (step * pxPerSecond >= minLabelPx) return step;
  return steps.at(-1)!;
}
