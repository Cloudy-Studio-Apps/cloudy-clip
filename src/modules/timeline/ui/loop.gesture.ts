import type { Micros } from "@/core";
import type { LoopRange } from "@/modules/preview";
import { snapTime } from "../logic/placement";

/**
 * Dragging one end of the loop: `place` shows the range through the DOM on every move (the end
 * snapped to `candidates` within `threshold`, unless Ctrl or Cmd is held at that move), and
 * `commit` gets the one new range on release. Escape puts the band back and sends nothing. The
 * ends may cross; they are kept in order.
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
    const free = event.ctrlKey || event.metaKey;
    const moved = { ...loop, [edge]: free ? raw : snapTime(raw, candidates, threshold) };
    range = { from: Math.min(moved.from, moved.to), to: Math.max(moved.from, moved.to) };
    place(range);
  };
  const stop = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKey);
  };
  const onUp = () => {
    stop();
    if (range.from !== loop.from || range.to !== loop.to) commit(range);
  };
  const onCancel = () => {
    stop();
    place(loop);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") onCancel();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey);
}
