import type { FaderDrag } from "../../sound.types";

/** How far the pointer must travel, in px, before a press becomes a drag. */
const DRAG_PX = 3;

/**
 * Follows a drag along a fader or a slider: every move as a position (0 to 1, bottom to top or
 * left to right), and the release with the last one, or null when the pointer never moved (a
 * click, or one half of a double-click, changes nothing). The caller writes the DOM and the live
 * sound; no React on the way (rule 24).
 */
export function startFaderDrag({ down, track, axis, start, grabbed, onMove, onEnd }: FaderDrag) {
  const box = track.getBoundingClientRect();
  const length = Math.max(1, axis === "y" ? box.height : box.width);
  const coordinate = (event: PointerEvent) => (axis === "y" ? event.clientY : event.clientX);
  const at = (event: PointerEvent) =>
    axis === "y" ? (box.bottom - event.clientY) / length : (event.clientX - box.left) / length;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  // On the handle it moves with the pointer's travel; from the groove it jumps to the pointer.
  const origin = at(down);
  const position = (event: PointerEvent) => clamp(grabbed ? start + at(event) - origin : at(event));

  let last: number | null = null;
  const move = (event: PointerEvent) => {
    if (last === null && Math.abs(coordinate(event) - coordinate(down)) < DRAG_PX) return;
    last = position(event);
    onMove(last);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onEnd(last);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}
