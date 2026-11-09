import { movePointTo, placeOf, screenOf, warpedPlaces } from "../../logic/color/warper.edit";
import { WARP_VIEW } from "./warper.paint";
import type { WarpDragOptions } from "./tools.types";

/** How far (px) the pointer must move before a press becomes a drag. */
const DEAD_ZONE = 3;

/**
 * Drags a Warper point. It reports the warper as it would be and writes nothing itself (the caller
 * paints the grid and the live values). The point keeps its offset from the pointer (a press doesn't
 * snap it), and until the pointer has moved 3 px nothing moves, so a click leaves the warper as
 * given. Ends once: on release, or null on Escape.
 */
export function startWarpDrag({ event, svg, warper, index, onMove, onEnd }: WarpDragOptions): void {
  const rect = svg.getBoundingClientRect();
  const scale = WARP_VIEW.size / rect.width;
  const start = screenOf(warpedPlaces(warper)[index]!, WARP_VIEW.radius);
  let moved = false;
  const at = (e: PointerEvent) => {
    const dx = e.clientX - event.clientX;
    const dy = e.clientY - event.clientY;
    if (!moved && Math.hypot(dx, dy) < DEAD_ZONE) return warper;
    moved = true;
    const place = placeOf(start.x + dx * scale, start.y + dy * scale, WARP_VIEW.radius);
    return movePointTo(warper, index, place);
  };
  let last = warper;
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
