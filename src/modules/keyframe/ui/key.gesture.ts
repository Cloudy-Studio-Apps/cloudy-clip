import { MICROS_PER_SECOND } from "@/core";
import { clampDelta } from "../logic/moves";
import { refId } from "../logic/picking";
import type { KeyDragOptions } from "../keyframe.types";

/**
 * Drags the selected keys: on move, the diamonds (found once, at the start) slide by the clamped
 * delta straight in the DOM; on release one `onDrop` with the delta. Escape cancels.
 */
export function startKeyDrag({ event, root, pxPerSecond, keys, onDrop }: KeyDragOptions): void {
  const wanted = new Set(keys.map(({ ref }) => refId(ref)));
  const diamonds = [...root.querySelectorAll<HTMLElement>("[data-key-ref]")].filter((el) =>
    wanted.has(el.dataset.keyRef ?? ""),
  );
  const moved = keys.map((k) => k.moved);
  const startX = event.clientX;
  let delta = 0;

  const show = (px: number) => {
    for (const el of diamonds) el.style.transform = px === 0 ? "" : `translateX(${px}px)`;
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  function move(e: PointerEvent) {
    const wantedDelta = Math.round(((e.clientX - startX) / pxPerSecond) * MICROS_PER_SECOND);
    delta = clampDelta(moved, wantedDelta);
    show((delta / MICROS_PER_SECOND) * pxPerSecond);
  }
  function up() {
    stop();
    show(0);
    if (delta !== 0) onDrop(delta);
  }
  function cancel() {
    stop();
    show(0);
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
