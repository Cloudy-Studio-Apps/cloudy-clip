import type { ChainDrag } from "../sound.types";

/** How far the pointer must travel, in px, before a press becomes a drag. */
const DRAG_PX = 3;

/**
 * Follows a row of an effect chain dragged up or down: the row follows the pointer through
 * `style`, and the release reports the travel, or null when the pointer never moved (a click).
 * No React on the way (rule 24).
 */
export function startChainDrag({ down, row, onEnd }: ChainDrag): void {
  let dy: number | null = null;
  const move = (event: PointerEvent) => {
    const travel = event.clientY - down.clientY;
    if (dy === null && Math.abs(travel) < DRAG_PX) return;
    dy = travel;
    row.style.transform = `translateY(${dy}px)`;
    row.style.zIndex = "1";
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    row.style.transform = "";
    row.style.zIndex = "";
    onEnd(dy);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}
