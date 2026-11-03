import type { FaderDrag } from "../sound.types";

/**
 * Follows a drag along a fader or a slider: every move as a position (0 to 1, bottom to top or
 * left to right), the release as one. The caller writes the DOM and the live sound; no React on
 * the way (rule 24).
 */
export function startFaderDrag({ down, track, axis, start, grabbed, onMove, onEnd }: FaderDrag) {
  const box = track.getBoundingClientRect();
  const length = Math.max(1, axis === "y" ? box.height : box.width);
  const at = (event: PointerEvent) =>
    axis === "y" ? (box.bottom - event.clientY) / length : (event.clientX - box.left) / length;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  // On the handle it moves with the pointer's travel; elsewhere it jumps to the pointer.
  const origin = at(down);
  const position = (event: PointerEvent) => clamp(grabbed ? start + at(event) - origin : at(event));

  let last = position(down);
  if (!grabbed) onMove(last);
  const move = (event: PointerEvent) => {
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
