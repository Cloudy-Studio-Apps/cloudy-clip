import { MICROS_PER_SECOND } from "@/core";
import { clampDelta } from "../logic/moves";
import { refId } from "../logic/picking";
import { snapMove } from "../logic/snap";
import type { CurveDragOptions, CurveDragState } from "../keyframe.types";

/** How far the pointer goes before a press is a drag, in px. */
const DRAG_THRESHOLD = 3;

/**
 * Drags the selected keys of the graph in time and value, each by its own scale. Shift keeps the
 * axis with the larger movement. Time snaps like `startKeyDrag` (Ctrl turns targets off). The state is handed to `onPreview` once per animation frame and
 * to `onDrop` on release; nothing is written here. Escape cancels.
 */
export function startCurveDrag({
  event,
  pxPerSecond,
  keys,
  snap,
  onPreview,
  onDrop,
  onClick,
}: CurveDragOptions): void {
  const moved = keys.map((k) => k.moved);
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;
  let state: CurveDragState = { delta: 0, values: new Map() };
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
    if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return;
    dragging = true;
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;
    if (e.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    let delta = 0;
    if (dx !== 0) {
      const { targets, frame } = snap(e.ctrlKey || e.metaKey);
      const wanted = clampDelta(moved, Math.round((dx / pxPerSecond) * MICROS_PER_SECOND));
      const times = moved.map((m) => m.time);
      delta = clampDelta(moved, snapMove(wanted, times, targets, pxPerSecond, frame));
    }
    const values = new Map<string, number>();
    if (dy !== 0) {
      for (const k of keys) {
        const raw = k.scale.toValue(k.scale.toY(k.value) + dy);
        const next = Math.min(k.max ?? Infinity, Math.max(k.min ?? -Infinity, raw));
        if (next !== k.value) values.set(refId(k.ref), next);
      }
    }
    state = { delta, values };
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        onPreview(state);
      });
    }
  }
  function up() {
    stop();
    if (!dragging) onClick?.();
    else if (state.delta !== 0 || state.values.size > 0) onDrop(state);
    else onPreview(undefined);
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
