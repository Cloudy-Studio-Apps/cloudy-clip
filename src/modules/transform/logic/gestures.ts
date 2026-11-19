import { normalizeRotation, type ClipPlacement, type ClipTransform } from "@/modules/project";
import type { FramePoint } from "../transform.types";

/** Smallest and largest scale a corner drag can reach (the command accepts the same range). */
export const MIN_SCALE = 0.01;
export const MAX_SCALE = 20;
/** Rotation step while Shift is held, in degrees. */
export const ROTATION_STEP = 15;

/** Moves by a frame-pixel delta; an axis within `snap` px of the frame's center snaps to it. */
export function moveTransform(
  start: ClipTransform,
  delta: FramePoint,
  snap: number,
): { transform: ClipTransform; snappedX: boolean; snappedY: boolean } {
  const x = start.x + delta.x;
  const y = start.y + delta.y;
  const snappedX = Math.abs(x) <= snap;
  const snappedY = Math.abs(y) <= snap;
  return {
    transform: { ...start, x: snappedX ? 0 : x, y: snappedY ? 0 : y },
    snappedX,
    snappedY,
  };
}

/** Largest Width or Height a side drag can reach either way (the property accepts the same). */
export const MAX_STRETCH = 20;
/** Farthest the pivot can go from the picture's center, as a fraction of its size. */
export const MAX_PIVOT = 10;

/** Closer to the pivot than this (output px), a side drag does nothing: the ratio would explode. */
const STRETCH_DEAD_ZONE = 4;

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/** Scales about the pivot (`center`), by how much further from it the pointer is than at the start. */
export function scaleTransform(
  start: ClipTransform,
  center: FramePoint,
  from: FramePoint,
  to: FramePoint,
): ClipTransform {
  const before = Math.hypot(from.x - center.x, from.y - center.y);
  if (before === 0) return start;
  const after = Math.hypot(to.x - center.x, to.y - center.y);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (start.scale * after) / before));
  return { ...start, scale };
}

/** Rotates about the pivot (`center`) by the angle the pointer swept; `step` snaps (Shift). */
export function rotateTransform(
  start: ClipTransform,
  center: FramePoint,
  from: FramePoint,
  to: FramePoint,
  step = 0,
): ClipTransform {
  const angle = (p: FramePoint) => (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
  let rotation = normalizeRotation(start.rotation + angle(to) - angle(from));
  if (step > 0) rotation = normalizeRotation(Math.round(rotation / step) * step);
  return { ...start, rotation };
}

/**
 * Stretches one axis about the pivot, by how much further from it along the picture's own axis
 * the pointer is than at the start. Passing the pivot flips the sign (a flip), as in After Effects.
 */
export function stretchTransform(
  start: ClipTransform,
  pivot: FramePoint,
  axis: "x" | "y",
  from: FramePoint,
  to: FramePoint,
): ClipTransform {
  const turn = (start.rotation * Math.PI) / 180;
  const along =
    axis === "x"
      ? { x: Math.cos(turn), y: Math.sin(turn) }
      : { x: -Math.sin(turn), y: Math.cos(turn) };
  const reach = (p: FramePoint) => (p.x - pivot.x) * along.x + (p.y - pivot.y) * along.y;
  const before = reach(from);
  if (Math.abs(before) < STRETCH_DEAD_ZONE) return start;
  const field = axis === "x" ? "scaleX" : "scaleY";
  return { ...start, [field]: clamp((start[field] * reach(to)) / before, MAX_STRETCH) };
}

/**
 * Moves the pivot by a frame-pixel delta while the picture stays put: the pivot's position (`x`,
 * `y`) follows the pointer, and its place in the picture moves the other way in the picture's own
 * (rotated, mirrored) axes. A picture squashed to nothing keeps its pivot.
 */
export function pivotTransform(
  start: ClipTransform,
  placement: ClipPlacement,
  delta: FramePoint,
): ClipTransform {
  if (placement.width === 0 || placement.height === 0) return start;
  const turn = (start.rotation * Math.PI) / 180;
  const localX = delta.x * Math.cos(turn) + delta.y * Math.sin(turn);
  const localY = -delta.x * Math.sin(turn) + delta.y * Math.cos(turn);
  const pivotX = start.pivotX + localX / (placement.width * (placement.flipX ? -1 : 1));
  const pivotY = start.pivotY + localY / (placement.height * (placement.flipY ? -1 : 1));
  return {
    ...start,
    x: start.x + delta.x,
    y: start.y + delta.y,
    pivotX: clamp(pivotX, MAX_PIVOT),
    pivotY: clamp(pivotY, MAX_PIVOT),
  };
}
