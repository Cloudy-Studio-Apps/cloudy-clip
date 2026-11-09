import type { Micros } from "@/core";
import type { KeyTrack } from "@/modules/project";
import { pxToTime, timeToPx } from "@/modules/timeline";
import type { LevelAt, LineKey, LinePoint, StrokePoint } from "../sound.types";
import { clampDb, lineDb } from "./automation";
import { lineXs } from "./clipline";
import { faderDb } from "./fader";

/** The keys of a track's volume line, in px from the timeline's start. */
export function trackLineKeys(line: KeyTrack | undefined, pxPerSecond: number): LineKey[] {
  if (!line) return [];
  return line.keys.flatMap((key) =>
    typeof key.value === "number"
      ? [{ keyId: key.id, x: timeToPx(key.t, pxPerSecond), db: key.value }]
      : [],
  );
}

/**
 * A track's volume line drawn from `from` to `to` px of the timeline: flat at 0 dB when it has no
 * keys, otherwise read where it bends (see `lineXs`).
 */
export function trackLinePoints(
  line: KeyTrack | undefined,
  from: number,
  to: number,
  pxPerSecond: number,
): LinePoint[] {
  const keys = trackLineKeys(line, pxPerSecond);
  const bends = line?.keys.some((k) => k.ease !== undefined && k.ease.kind !== "linear") ?? false;
  return lineXs(keys, from, to, bends).map((x) => ({
    x,
    db: lineDb(line, pxToTime(x, pxPerSecond)),
  }));
}

/**
 * A stroke as levels: each point's time from its x in `box` (whose left edge is the timeline time
 * `start`), kept inside `low`..`high`, and its level from its height in the box, on the fader's
 * taper as the lines are drawn.
 */
export function strokeLevels(
  points: readonly StrokePoint[],
  box: { left: number; top: number; height: number },
  start: Micros,
  pxPerSecond: number,
  low: Micros,
  high: Micros,
): LevelAt[] {
  return points.map(({ clientX, clientY }) => {
    const at = start + pxToTime(clientX - box.left, pxPerSecond);
    const position = 1 - (clientY - box.top) / Math.max(1, box.height);
    return {
      at: Math.min(high, Math.max(low, at)),
      db: clampDb(faderDb(Math.min(1, Math.max(0, position)))),
    };
  });
}
