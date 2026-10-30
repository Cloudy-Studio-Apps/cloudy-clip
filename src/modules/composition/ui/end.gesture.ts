import type { Micros } from "@/core";

/**
 * Dragging the end marker: `place` moves it through the DOM on every move, and `commit` gets the
 * one length on release, so it is one undo step.
 */
export function startEndDrag(
  down: PointerEvent,
  start: Micros,
  timeAtDelta: (px: number) => Micros,
  place: (time: Micros) => void,
  commit: (time: Micros) => void,
): void {
  const originX = down.clientX;
  let time = start;
  const onMove = (event: PointerEvent) => {
    time = Math.max(1, start + timeAtDelta(event.clientX - originX));
    place(time);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (time !== start) commit(time);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
