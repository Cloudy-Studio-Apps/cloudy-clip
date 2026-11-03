import type { MotionDragOptions } from "../keyframe.types";

/** How far the pointer goes before a press is a drag, in px. */
const DRAG_THRESHOLD = 3;

/**
 * Drags one diamond of the motion path: it follows the pointer straight in the DOM, along only
 * the axes that have a key there, and on release one `onDrop` with the move in output pixels. A
 * press that barely moves does nothing. Escape cancels.
 */
export function startMotionDrag({
  event,
  frame,
  size,
  diamond,
  at,
  axes,
  onDrop,
}: MotionDragOptions): void {
  const box = frame.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const scaleX = size.width / box.width;
  const scaleY = size.height / box.height;
  let dx = 0;
  let dy = 0;
  let dragging = false;

  const show = (x: number, y: number) => {
    diamond.style.left = `${((at.x + x) / size.width) * 100}%`;
    diamond.style.top = `${((at.y + y) / size.height) * 100}%`;
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
    dragging = true;
    dx = axes.x ? (e.clientX - startX) * scaleX : 0;
    dy = axes.y ? (e.clientY - startY) * scaleY : 0;
    show(dx, dy);
  }
  function up() {
    stop();
    if (!dragging) return;
    const delta = { x: Math.round(dx), y: Math.round(dy) };
    if (delta.x === 0 && delta.y === 0) return show(0, 0);
    onDrop(delta);
  }
  function cancel() {
    stop();
    show(0, 0);
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
