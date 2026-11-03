import type { Micros } from "@/core";
import type { LoopRange } from "../preview.types";

/**
 * A loop region as the clock keeps it: ends in order, rounded and clamped to `[0, duration]`;
 * null when what's left is shorter than one frame.
 */
export function fitLoop(range: LoopRange, duration: Micros, frame: Micros): LoopRange | null {
  const end = Math.max(0, duration);
  const from = Math.min(Math.max(0, Math.round(Math.min(range.from, range.to))), end);
  const to = Math.min(Math.max(0, Math.round(Math.max(range.from, range.to))), end);
  return to - from < Math.max(1, frame) ? null : { from, to };
}

/**
 * Where a playhead that left `anchor` and would be at `raw` is, with a loop: once it crosses
 * `to` it goes round from `from`. One that left at or past `to` plays on.
 */
export function loopTime(anchor: Micros, raw: Micros, loop: LoopRange | null): Micros {
  if (!loop || anchor >= loop.to || raw < loop.to) return raw;
  return loop.from + ((raw - loop.to) % (loop.to - loop.from));
}
