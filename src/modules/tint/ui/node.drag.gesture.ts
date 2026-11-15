import type { GraphDragMove, GraphDragOptions } from "./ui.types";

/** How far (px) the pointer must move before a press becomes a drag. */
const DEAD_ZONE = 3;

/**
 * Drags in the node graph's own units. It writes nothing: the caller paints the DOM from `onMove`
 * (rule 24). Nothing moves until the pointer has gone 3 px, so a click leaves things as they are;
 * a node keeps its offset from the pointer because moves are measured from the press. Ends once:
 * on release with where it ended, or null on Escape (or if it never left the dead zone).
 */
export function startGraphDrag({ event, svg, onMove, onEnd }: GraphDragOptions): void {
  const toGraph = (e: PointerEvent): GraphDragMove => {
    const ctm = svg.getScreenCTM();
    const scale = ctm?.a || 1;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const at = point.matrixTransform(ctm?.inverse());
    return {
      dx: (e.clientX - event.clientX) / scale,
      dy: (e.clientY - event.clientY) / scale,
      at: [at.x, at.y],
    };
  };
  let moved = false;
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
  };
  const move = (e: PointerEvent) => {
    if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < DEAD_ZONE) {
      return;
    }
    moved = true;
    onMove(toGraph(e));
  };
  const up = (e: PointerEvent) => {
    stop();
    onEnd(moved ? toGraph(e) : null);
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
