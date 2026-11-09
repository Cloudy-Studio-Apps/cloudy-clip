import type { CurvePoint, CurveShape } from "../../tint.types";
import { monotoneCurve, periodicCurve } from "./curves";

// Edits of a curve's points, as the Curves tool makes them. Every list that comes out passes
// `validateGrade`: at least 2 points, x strictly increasing from 0 to 1, every value in 0…1. The
// end points keep their x; on a hue curve the two ends are the same hue, so they share their y.

/** The least distance in x between two points. */
export const POINT_GAP = 0.01;

/** How far either side of a picked hue the points that fence it in go. */
export const PICK_REACH = 0.06;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** A point's neutral y at `x`: on the diagonal for a custom curve, 0.5 for the others. */
export function neutralAt(shape: CurveShape, x: number): number {
  return shape === "tone" ? x : 0.5;
}

/** The curve through the points, as its shape reads it (a hue curve wraps). */
export function curveOf(shape: CurveShape, points: readonly CurvePoint[]): (x: number) => number {
  return shape === "hue" ? periodicCurve(points) : monotoneCurve(points);
}

/** The index of the point nearest `(x, y)` within `reach` (both axes in 0…1 of the box), or -1. */
export function nearestPoint(
  points: readonly CurvePoint[],
  x: number,
  y: number,
  reach: { x: number; y: number },
): number {
  let best = -1;
  let bestDistance = 1;
  points.forEach(([px, py], i) => {
    const d = Math.hypot((px - x) / reach.x, (py - y) / reach.y);
    if (d <= bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/** The points with a new one at `(x, y)` and its index, or null where it can't go (an end, or too near another). */
export function insertPoint(
  points: readonly CurvePoint[],
  x: number,
  y: number,
): { points: CurvePoint[]; index: number } | null {
  if (x < POINT_GAP || x > 1 - POINT_GAP) return null;
  if (points.some(([px]) => Math.abs(px - x) < POINT_GAP)) return null;
  const index = points.findIndex(([px]) => px > x);
  if (index <= 0) return null;
  const next = [...points];
  next.splice(index, 0, [x, clamp01(y)]);
  return { points: next, index };
}

/**
 * The point `index` moved to `(x, y)`: y kept in 0…1; an end point keeps its x, any other stays
 * between its neighbours. On a hue curve the other end takes the same y.
 */
export function movePoint(
  points: readonly CurvePoint[],
  index: number,
  x: number,
  y: number,
  shape: CurveShape,
): CurvePoint[] {
  const next = [...points];
  const last = points.length - 1;
  const ny = clamp01(y);
  if (index === 0 || index === last) {
    next[index] = [points[index]![0], ny];
    if (shape === "hue") next[index === 0 ? last : 0] = [points[index === 0 ? last : 0]![0], ny];
    return next;
  }
  const low = points[index - 1]![0] + POINT_GAP;
  const high = points[index + 1]![0] - POINT_GAP;
  next[index] = [Math.min(high, Math.max(low, x)), ny];
  return next;
}

/** The points without `index`, or null for an end point or when only 2 would be left. */
export function removePoint(points: readonly CurvePoint[], index: number): CurvePoint[] | null {
  if (index <= 0 || index >= points.length - 1 || points.length <= 2) return null;
  return points.filter((_, i) => i !== index);
}

/** The point `index` back at its neutral y (both ends of a hue curve). */
export function resetPoint(
  points: readonly CurvePoint[],
  index: number,
  shape: CurveShape,
): CurvePoint[] {
  const x = points[index]![0];
  return movePoint(points, index, x, neutralAt(shape, x), shape);
}

/**
 * Points at a picked hue and `PICK_REACH` either side of it (wrapping), each on the curve as it is,
 * so the curve barely changes until the middle one is dragged. Points too near another or an end
 * are left out; null when none could go.
 */
export function pickHuePoints(points: readonly CurvePoint[], hue: number): CurvePoint[] | null {
  const curve = periodicCurve(points);
  const wrap = (x: number) => x - Math.floor(x);
  let next: CurvePoint[] = [...points];
  let added = false;
  for (const x of [hue - PICK_REACH, hue, hue + PICK_REACH].map(wrap)) {
    const placed = insertPoint(next, x, curve(x));
    if (placed) {
      next = placed.points;
      added = true;
    }
  }
  return added ? next : null;
}
