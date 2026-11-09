import type { LineDrag } from "../../sound.types";
import { draggedPoint } from "../../logic/clipline";

/** How far the pointer must travel, in px, before a press becomes a drag. */
const DRAG_PX = 3;

/**
 * Follows a drag of a point of a clip's volume line: every move as the point's place (the caller
 * writes the DOM, no React on the way), and the release with the last one, or null when the
 * pointer never moved (a click, or half of a double-click) or Escape was pressed.
 */
export function startLineGesture({ down, area, from, width, onMove, onEnd }: LineDrag): void {
  const height = area.getBoundingClientRect().height;
  let last: ReturnType<typeof draggedPoint> | null = null;

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    const dx = e.clientX - down.clientX;
    const dy = e.clientY - down.clientY;
    if (last === null && Math.hypot(dx, dy) < DRAG_PX) return;
    last = draggedPoint(from, dx, dy, height, width);
    onMove(last);
  }
  function up() {
    stop();
    onEnd(last);
  }
  function cancel() {
    stop();
    if (last) onMove(from);
    onEnd(null);
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
