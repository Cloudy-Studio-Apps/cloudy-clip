import { dragWindow } from "../../logic/range";
import type { RangeDragOptions } from "./tools.types";

/** How far (px) the pointer must move before a press becomes a drag. */
const DEAD_ZONE = 3;

/**
 * Drags a range bar's window: an end, or the whole window, by how far the pointer has gone since
 * the press (so the grabbed spot stays under the pointer). Nothing moves until the pointer has
 * gone 3 px, so a click sends nothing. It reports the window as it would be and writes nothing
 * itself. Ends once: on release, or null when it never moved or on Escape.
 */
export function startRangeDrag({
  event,
  bar,
  window: start,
  part,
  wrap,
  onMove,
  onEnd,
}: RangeDragOptions): void {
  const width = Math.max(bar.getBoundingClientRect().width, 1);
  let moved = false;
  let last = start;
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  const move = (e: PointerEvent) => {
    const dx = e.clientX - event.clientX;
    if (!moved && Math.abs(dx) < DEAD_ZONE) return;
    moved = true;
    last = dragWindow(start, part, dx / width, wrap);
    onMove(last);
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
    e.stopPropagation();
    cancel();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
}
