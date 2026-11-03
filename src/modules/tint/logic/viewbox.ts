import type { GraphView } from "../tint.types";

/** Narrowest and widest view, in graph units: how far the graph zooms in and out. */
const MIN_WIDTH = 260;
const MAX_WIDTH = 4000;

/** Graph units per screen pixel for a view drawn into `width × height` px (SVG "meet"). */
export function unitsPerPx(view: GraphView, width: number, height: number): number {
  return Math.max(view.width / Math.max(1, width), view.height / Math.max(1, height));
}

/** The view moved by a drag of `dx, dy` screen pixels: the graph follows the pointer. */
export function panView(view: GraphView, dx: number, dy: number, scale: number): GraphView {
  return { ...view, x: view.x - dx * scale, y: view.y - dy * scale };
}

/** The view zoomed by `factor` (above 1 zooms out) around a point in graph units, which stays put. */
export function zoomView(
  view: GraphView,
  factor: number,
  at: readonly [number, number],
): GraphView {
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, view.width * factor));
  const applied = width / view.width;
  return {
    x: at[0] - (at[0] - view.x) * applied,
    y: at[1] - (at[1] - view.y) * applied,
    width,
    height: view.height * applied,
  };
}
