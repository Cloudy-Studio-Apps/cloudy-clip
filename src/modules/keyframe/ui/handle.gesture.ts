import type { HandleDragOptions, HandleState } from "../keyframe.types";

/** How far the pointer goes before a press is a drag, in px. */
const DRAG_THRESHOLD = 2;

/**
 * Drags a curve handle. The eases for the pointer's place come from `resolve` and go to
 * `onPreview` once per animation frame and to `onDrop` on release; nothing is written here.
 * Escape cancels.
 */
export function startHandleDrag({ event, resolve, onPreview, onDrop }: HandleDragOptions): void {
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;
  let state: HandleState = new Map();
  let frame = 0;

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    cancelAnimationFrame(frame);
    frame = 0;
  };
  function move(e: PointerEvent) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragging = true;
    state = resolve(dx, dy);
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        onPreview(state);
      });
    }
  }
  function up() {
    stop();
    if (dragging) onDrop(state);
  }
  function cancel() {
    stop();
    onPreview(undefined);
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
