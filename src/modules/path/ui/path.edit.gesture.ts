import { movePart } from "@/modules/project";
import type { PathEditOptions } from "../path.types";
import { paintPath } from "./path.paint";

/** How far the pointer goes before a press is a drag, in px. */
const DRAG_THRESHOLD = 3;

/**
 * Drags a point or one of its handles: the overlay is redrawn in the DOM as it moves (Alt moves a
 * handle alone, breaking it from the other), and release hands the new points to `onDrop`, which
 * sends one `path.update`. A press that barely moves does nothing. Escape cancels.
 */
export function startPathEdit({
  event,
  frame,
  size,
  points,
  closed,
  index,
  part,
  onDrop,
}: PathEditOptions): void {
  const box = frame.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  const scaleX = size.width / box.width;
  const scaleY = size.height / box.height;
  let current = points;
  let dragging = false;

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    const dx = e.clientX - event.clientX;
    const dy = e.clientY - event.clientY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragging = true;
    current = movePart(points, index, part, dx * scaleX, dy * scaleY, e.altKey);
    paintPath(frame, current, closed, size);
  }
  function up() {
    stop();
    if (dragging) onDrop(current);
  }
  function cancel() {
    stop();
    paintPath(frame, points, closed, size);
  }
  function key(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    cancel();
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
}
