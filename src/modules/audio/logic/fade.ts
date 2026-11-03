import { MICROS_PER_SECOND } from "@/core";
import { DEFAULT_SOUND, fadeLevel } from "@/modules/project";
import { pxToTime } from "@/modules/timeline";
import type { FadeBoxes, FadeEdge } from "../audio.types";

const STEPS = 16;

/**
 * The edge of a fade-in as a unit square (x along the fade, y down from the top of the clip):
 * the equal-power level the preview and the export use, `1 - level`. A fade-out is the mirror.
 */
export const FADE_CURVE: readonly (readonly [number, number])[] = Array.from(
  { length: STEPS + 1 },
  (_, i) => {
    const x = i / STEPS;
    const level = fadeLevel(
      { ...DEFAULT_SOUND, fadeIn: MICROS_PER_SECOND },
      { start: 0, duration: MICROS_PER_SECOND },
      x * MICROS_PER_SECOND,
    );
    return [x, 1 - level] as const;
  },
);

/** The points of the line along the curve, for an SVG `polyline`. */
export const FADE_LINE = FADE_CURVE.map(([x, y]) => `${x},${y}`).join(" ");

/** The points of the attenuated area above the curve, for an SVG `polygon`. */
export const FADE_AREA = `0,0 ${FADE_LINE} 1,0`;

/**
 * The fade a drag of `dx` pixels leaves, from the fade the drag began with: a fade-in grows
 * to the right, a fade-out to the left, within 0 and the clip's length.
 */
export function draggedFade(
  edge: FadeEdge,
  current: number,
  dx: number,
  pxPerSecond: number,
  duration: number,
): number {
  const delta = pxToTime(edge === "in" ? dx : -dx, pxPerSecond);
  return Math.min(duration, Math.max(0, current + delta));
}

/** Side of a fade handle in pixels (`size-2.5`). */
const HANDLE_PX = 10;

/**
 * Where the two handles sit on a clip `width` pixels wide, in pixels from its left edge, given the
 * width of each fade. Each handle ideally ends where its fade does, inside the clip. When they
 * would meet or cross, they become an adjacent pair around the middle of their ideal places, and
 * the pair shifts as a whole to stay within the clip, so both can always be grabbed. On a clip
 * narrower than two handles, each gets half of it.
 */
export function handleBoxes(width: number, inPx: number, outPx: number): FadeBoxes {
  const size = HANDLE_PX;
  if (width < 2 * size) {
    const half = width / 2;
    return { in: { left: 0, size: half }, out: { left: half, size: half } };
  }
  const room = width - size;
  const a = Math.min(room, Math.max(0, inPx));
  const b = Math.min(room, Math.max(0, width - outPx - size));
  if (b - a >= size) return { in: { left: a, size }, out: { left: b, size } };
  const middle = (a + b + size) / 2;
  const shift =
    middle - size < 0 ? size - middle : middle + size > width ? width - middle - size : 0;
  return {
    in: { left: middle - size + shift, size },
    out: { left: middle + shift, size },
  };
}
