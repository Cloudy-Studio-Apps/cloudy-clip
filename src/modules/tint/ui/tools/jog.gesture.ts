import type { JogDragOptions } from "./tools.types";

/** Drags the master jog bar sideways: all across the bar is 2. Reports every move, ends once (null on Escape). */
export function startJogDrag({ event, width, start, onMove, onEnd }: JogDragOptions): void {
  const x0 = event.clientX;
  let last = start;
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  const move = (e: PointerEvent) => {
    const raw = start + ((e.clientX - x0) / width) * 2;
    last = Math.min(1, Math.max(-1, Math.round(raw * 100) / 100));
    onMove(last);
  };
  const up = () => {
    stop();
    onEnd(last);
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
