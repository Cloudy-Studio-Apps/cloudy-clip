import type { Micros } from "@/core";
import type { LoopRange } from "@/modules/preview";
import { snapTime } from "../logic/placement";

/**
 * Dragging one end of the loop: `place` shows the range through the DOM on every move (the end
 * snapped to `candidates` within `threshold`), and `commit` gets the one new range on release.
 * The ends may cross; the clock puts them in order.
 */
export function startLoopDrag(options: {
  down: PointerEvent;
  loop: LoopRange;
  edge: keyof LoopRange;
  candidates: readonly Micros[];
  threshold: Micros;
  timeAtDelta: (px: number) => Micros;
  place: (range: LoopRange) => void;
  commit: (range: LoopRange) => void;
}): void {
  const { down, loop, edge, candidates, threshold, timeAtDelta, place, commit } = options;
  let range = loop;
  const onMove = (event: PointerEvent) => {
    const raw = Math.max(0, loop[edge] + timeAtDelta(event.clientX - down.clientX));
    const moved = { ...loop, [edge]: snapTime(raw, candidates, threshold) };
    range = { from: Math.min(moved.from, moved.to), to: Math.max(moved.from, moved.to) };
    place(range);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (range.from !== loop.from || range.to !== loop.to) commit(range);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
