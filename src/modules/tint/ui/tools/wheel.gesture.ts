import { wheelPuckAt } from "../../logic/color/wheels";
import type { WheelDragOptions } from "./tools.types";

/**
 * Drags a wheel's puck. It reports the wheel under the pointer and writes nothing itself (the
 * caller moves the DOM and the live values), and ends once: on release, or null on Escape.
 */
export function startWheelDrag({ event, ring, wheel, onMove, onEnd }: WheelDragOptions): void {
  const box = ring.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const at = (e: PointerEvent) => wheelPuckAt(wheel, e.clientX - cx, e.clientY - cy, box.width / 2);
  let last = at(event);
  onMove(last);
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  const move = (e: PointerEvent) => {
    last = at(e);
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
