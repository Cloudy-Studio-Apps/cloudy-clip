import { CHART_GRID, quadPoint } from "../logic/chart";
import type { ChartCorners } from "../tint.types";

/**
 * Draws the chart over the viewer in the DOM: the 6 × 4 grid as one path (in the box's 0…1 units;
 * a bilinear quad's grid lines are straight) and each corner's handle where it is.
 */
export function paintChart(
  path: SVGPathElement | null,
  handles: readonly (HTMLElement | null)[],
  corners: ChartCorners,
): void {
  const { columns, rows } = CHART_GRID;
  const line = (a: { u: number; v: number }, b: { u: number; v: number }) =>
    `M${a.u} ${a.v}L${b.u} ${b.v}`;
  const d: string[] = [];
  for (let i = 0; i <= columns; i++) {
    d.push(line(quadPoint(corners, i / columns, 0), quadPoint(corners, i / columns, 1)));
  }
  for (let j = 0; j <= rows; j++) {
    d.push(line(quadPoint(corners, 0, j / rows), quadPoint(corners, 1, j / rows)));
  }
  path?.setAttribute("d", d.join(""));
  corners.forEach((corner, i) => {
    const handle = handles[i];
    if (!handle) return;
    handle.style.left = `${corner.u * 100}%`;
    handle.style.top = `${corner.v * 100}%`;
  });
}
