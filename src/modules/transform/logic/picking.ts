import type { ClipPlacement } from "@/modules/project";
import type { FramePoint } from "../transform.types";

/** Whether a frame point falls inside a (possibly rotated) placed picture. */
export function containsPoint(placement: ClipPlacement, point: FramePoint): boolean {
  const angle = (-placement.rotation * Math.PI) / 180;
  const dx = point.x - placement.cx;
  const dy = point.y - placement.cy;
  // Rotate the point into the picture's own axes.
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(localX) <= placement.width / 2 && Math.abs(localY) <= placement.height / 2;
}

/** The first placement (top-most layer first) containing the point, as an index; -1 if none. */
export function topmostAt(placements: readonly ClipPlacement[], point: FramePoint): number {
  return placements.findIndex((placement) => containsPoint(placement, point));
}
