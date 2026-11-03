import type { Micros } from "@/core";
import { snapTime } from "@/modules/timeline";
import { floorToFrame } from "../logic/markers";

/** Pixels a press must travel before it is a drag rather than a click. */
const DRAG_PX = 3;

/**
 * Dragging a marker's flag: `place` moves it through the DOM on every move (snapped to `candidates`
 * within `threshold`, else to the frame), and `commit` gets the one new time on release, so it is
 * one undo step. A press that never moves is a `click`.
 */
export function startFlagDrag(options: {
  down: PointerEvent;
  start: Micros;
  frame: Micros;
  candidates: readonly Micros[];
  threshold: Micros;
  timeAtDelta: (px: number) => Micros;
  place: (time: Micros) => void;
  commit: (time: Micros) => void;
  click: () => void;
}): void {
  const { down, start, frame, candidates, threshold, timeAtDelta, place, commit, click } = options;
  let time = start;
  let moved = false;
  const onMove = (event: PointerEvent) => {
    const dx = event.clientX - down.clientX;
    if (!moved && Math.abs(dx) < DRAG_PX) return;
    moved = true;
    const raw = Math.max(0, start + timeAtDelta(dx));
    const snapped = snapTime(raw, candidates, threshold);
    time = snapped === raw ? floorToFrame(raw, frame) : snapped;
    place(time);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (!moved) click();
    else if (time !== start) commit(time);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
