import type { Micros } from "@/core";
import type { MovedKey } from "../keyframe.types";

/**
 * Limits a move of keys, in timeline time. A key that starts inside its clip stays inside; one
 * that starts outside doesn't limit the move.
 */
export function clampDelta(items: readonly MovedKey[], delta: Micros): Micros {
  let low = -Infinity;
  let high = Infinity;
  for (const { time, clipStart, clipEnd } of items) {
    if (time < clipStart || time > clipEnd) continue;
    low = Math.max(low, clipStart - time);
    high = Math.min(high, clipEnd - time);
  }
  return Math.min(high, Math.max(low, delta));
}
