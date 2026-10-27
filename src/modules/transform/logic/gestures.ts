import { normalizeRotation, type ClipTransform } from "@/modules/project";
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

/** Scales about the picture's center, by how much further from it the pointer is than at the start. */
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

/** Rotates about the picture's center by the angle the pointer swept; `step` snaps (Shift). */
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
