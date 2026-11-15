import type { StrokeDrag, StrokePoint } from "../../sound.line.types";

/** How far the pointer must travel, in px, before a press becomes a stroke. */
const DRAG_PX = 3;

/**
 * Follows a stroke of Draw volume: every move with the stroke so far (the caller draws it through
 * the DOM, no React on the way), and the release with the whole stroke, or null when the pointer
 * never moved (a click), on Escape or on a cancel.
 */
export function startStroke({ down, onMove, onEnd }: StrokeDrag): void {
  const points: StrokePoint[] = [{ clientX: down.clientX, clientY: down.clientY }];
  let moved = false;

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    if (!moved && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < DRAG_PX) return;
    moved = true;
    points.push({ clientX: e.clientX, clientY: e.clientY });
    onMove(points);
  }
  function up() {
    stop();
    onEnd(moved ? points : null);
  }
  function cancel() {
    stop();
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
