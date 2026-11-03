import { MICROS_PER_SECOND } from "@/core";
import { stretchFactor } from "../logic/stretch";
import type { StretchOptions } from "../keyframe.types";

/** Smallest factor a stretch drag shows, so the keys never fold onto one point on screen. */
const LEAST = 0.01;

/**
 * Stretches the selection from the end opposite the grabbed one. On move, `onPreview` gets the
 * factor (the grabbed end follows the pointer); on release, `onDrop` gets it once. Escape cancels.
 */
export function startStretch({
  event,
  pxPerSecond,
  anchor,
  grabbed,
  onPreview,
  onDrop,
}: StretchOptions): void {
  const startX = event.clientX;
  let factor = 1;

  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    const pointer = grabbed + ((e.clientX - startX) / pxPerSecond) * MICROS_PER_SECOND;
    const raw = stretchFactor(anchor, grabbed, pointer);
    factor = Math.abs(raw) < LEAST ? Math.sign(raw || 1) * LEAST : raw;
    onPreview(factor);
  }
  function up() {
    stop();
    onPreview(undefined);
    if (factor !== 1) onDrop(factor);
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
