import { pathData } from "../logic/edit";
import type { FreehandOptions, PenOptions } from "../path.types";
import { framePoint } from "./path.paint";

/** How far the pointer goes before a pen click becomes a handle drag, in px. */
const DRAG_THRESHOLD = 3;

/** Draws one freehand stroke: the line follows the pointer in the DOM; release hands it over. */
export function startFreehand({ event, frame, size, line, onDone }: FreehandOptions): void {
  const stroke = [framePoint(frame, size, event.clientX, event.clientY)];
  const show = () =>
    line.setAttribute("d", stroke.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" "));
  const move = (e: PointerEvent) => {
    stroke.push(framePoint(frame, size, e.clientX, e.clientY));
    show();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    line.setAttribute("d", "");
    onDone(stroke);
  };
  show();
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

/**
 * One pen click: a corner where it lands; dragging before release pulls its out handle (the in
 * handle mirrored), redrawn in the DOM. `onChange` runs on release.
 */
export function startPenPoint({ event, frame, size, points, line, onChange }: PenOptions): void {
  const at = framePoint(frame, size, event.clientX, event.clientY);
  const point = { x: at.x, y: at.y, inX: 0, inY: 0, outX: 0, outY: 0 };
  points.push(point);
  line.setAttribute("d", pathData(points, false));
  const move = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < DRAG_THRESHOLD) return;
    const to = framePoint(frame, size, e.clientX, e.clientY);
    point.outX = to.x - at.x;
    point.outY = to.y - at.y;
    point.inX = -point.outX;
    point.inY = -point.outY;
    line.setAttribute("d", pathData(points, false));
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onChange();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}
