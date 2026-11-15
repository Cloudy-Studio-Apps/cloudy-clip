import type { ChartCorners } from "../tint.types";
import type { CornerDragOptions } from "./ui.types";

/** How far (px) the pointer must move before a press becomes a drag. */
const DEAD_ZONE = 3;

/**
 * Drags a corner of the color chart over the viewer. It reports the corners as they would be and
 * writes nothing itself (the caller paints the DOM). The corner keeps its offset from the pointer,
 * nothing moves until the pointer has gone 3 px, and it stays on the frame. Ends once: on release
 * (null when it never moved), or null on Escape.
 */
export function startCornerDrag({
  event,
  box,
  corners,
  index,
  onMove,
  onEnd,
}: CornerDragOptions): void {
  const rect = box.getBoundingClientRect();
  const grabbed = corners[index]!;
  let moved = false;
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  const at = (e: PointerEvent): ChartCorners => {
    const dx = e.clientX - event.clientX;
    const dy = e.clientY - event.clientY;
    if (!moved && Math.hypot(dx, dy) < DEAD_ZONE) return corners;
    moved = true;
    const next = [...corners] as ChartCorners;
    next[index] = { u: clamp(grabbed.u + dx / rect.width), v: clamp(grabbed.v + dy / rect.height) };
    return next;
  };
  let last = corners;
  // The corner keeps the pointer until release, wherever it goes.
  const holder = event.target instanceof Element ? event.target : null;
  holder?.setPointerCapture(event.pointerId);
  const stop = () => {
    if (holder?.hasPointerCapture(event.pointerId)) holder.releasePointerCapture(event.pointerId);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  const move = (e: PointerEvent) => {
    last = at(e);
    if (moved) onMove(last);
  };
  const up = () => {
    stop();
    onEnd(moved ? last : null);
  };
  const cancel = () => {
    stop();
    onEnd(null);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopImmediatePropagation();
    cancel();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
}
