import type { FadeGestureOptions } from "../audio.types";
import { draggedFade } from "../logic/fade";

/** Pixels the pointer must travel before the drag counts. */
const THRESHOLD = 3;

/**
 * Drags a fade handle. On move, `onPreview` gets the fade (direct DOM, no renders); on release,
 * `onDrop` gets it once, and only if it changed. Escape and a cancelled pointer put it back.
 */
export function startFadeGesture({
  down,
  edge,
  current,
  duration,
  pxPerSecond,
  onPreview,
  onDrop,
}: FadeGestureOptions): void {
  let fade = current;
  let moved = false;

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    const dx = e.clientX - down.clientX;
    if (!moved && Math.abs(dx) < THRESHOLD) return;
    moved = true;
    fade = draggedFade(edge, current, dx, pxPerSecond, duration);
    onPreview(fade);
  }
  function up() {
    stop();
    if (moved && fade !== current) onDrop(fade);
    else if (moved) onPreview(current);
  }
  function cancel() {
    stop();
    if (moved) onPreview(current);
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
