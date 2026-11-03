import { MICROS_PER_SECOND } from "@/core";
import { DEFAULT_SOUND, fadeLevel } from "@/modules/project";
import { pxToTime } from "@/modules/timeline";
import type { FadeEdge } from "../audio.types";

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
export const HANDLE_PX = 10;

/**
 * Where a fade's handle sits, in pixels from its own edge of the clip: at the end of the fade,
 * kept inside the clip. The fade-out handle has the corner; the fade-in handle stops at its inner
 * edge, so both can always be grabbed. `otherPx` is the other fade's width in pixels.
 */
export function handleOffset(edge: FadeEdge, fadePx: number, otherPx: number, width: number) {
  const room = Math.max(0, width - HANDLE_PX);
  const own = Math.min(room, fadePx);
  if (edge === "out") return own;
  const other = Math.min(room, otherPx);
  return Math.max(0, Math.min(own, width - other - 2 * HANDLE_PX));
}
