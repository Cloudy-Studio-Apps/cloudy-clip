import { movePoint, removePoint } from "../../logic/color/curves.edit";
import type { CurvePoint } from "../../tint.types";
import type { CurveDragOptions } from "./tools.types";

/** How far past the box's edge (px) a point is dragged off, and so removed. */
const OFF_BOX = 24;

/** How far (px) the pointer must move before a press becomes a drag. */
const DEAD_ZONE = 3;

/**
 * Drags a curve point. It reports the points as they would be and writes nothing itself (the caller
 * paints the DOM and the live values). The point keeps its offset from the pointer (a press doesn't
 * snap it), and until the pointer has moved 3 px nothing moves, so a click or a double-click leaves
 * the points as given. Dragged off the box, a point that can go is left out until it comes back; an
 * end point never goes, nor one of only two. Ends once: on release, or null on Escape.
 */
export function startCurveDrag({
  event,
  box,
  points,
  index,
  shape,
  onMove,
  onEnd,
}: CurveDragOptions): void {
  const rect = box.getBoundingClientRect();
  const [gx, gy] = points[index]!;
  let moved = false;
  const at = (e: PointerEvent): readonly CurvePoint[] => {
    const dx = e.clientX - event.clientX;
    const dy = e.clientY - event.clientY;
    if (!moved && Math.hypot(dx, dy) < DEAD_ZONE) return points;
    moved = true;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const outside = Math.max(-px, px - rect.width, -py, py - rect.height);
    const removed = outside > OFF_BOX ? removePoint(points, index) : null;
    const x = gx + dx / rect.width;
    const y = gy - dy / rect.height;
    return removed ?? movePoint(points, index, x, y, shape);
  };
  let last = at(event);
  onMove(last);
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  const move = (e: PointerEvent) => {
    last = at(e);
    onMove(last);
  };
  const up = () => {
    stop();
    onEnd(last);
  };
  const cancel = () => {
    stop();
    onEnd(null);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    cancel();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
}
