import { pathData, type PathPoint } from "@/modules/project";

/** A spot in the frame (output px from its center) as CSS `left`/`top` percentages. */
export function spot(x: number, y: number, size: { width: number; height: number }) {
  return {
    left: `${((x + size.width / 2) / size.width) * 100}%`,
    top: `${((y + size.height / 2) / size.height) * 100}%`,
  };
}

/**
 * Redraws the path overlay straight on the DOM for `points` while a drag runs (no React renders):
 * the line, each point and the shown handles with their stems.
 */
export function paintPath(
  root: HTMLElement,
  points: readonly PathPoint[],
  closed: boolean,
  size: { width: number; height: number },
): void {
  const d = pathData(points, closed);
  root.querySelectorAll("[data-path-line]").forEach((line) => line.setAttribute("d", d));
  points.forEach((p, i) => {
    const point = root.querySelector<HTMLElement>(`[data-point="${i}"]`);
    if (point) Object.assign(point.style, spot(p.x, p.y, size));
    for (const side of ["in", "out"] as const) {
      const hx = p.x + p[`${side}X`];
      const hy = p.y + p[`${side}Y`];
      const handle = root.querySelector<HTMLElement>(`[data-handle="${i}:${side}"]`);
      if (handle) Object.assign(handle.style, spot(hx, hy, size));
      const stem = root.querySelector(`[data-stem="${i}:${side}"]`);
      stem?.setAttribute("x1", String(p.x));
      stem?.setAttribute("y1", String(p.y));
      stem?.setAttribute("x2", String(hx));
      stem?.setAttribute("y2", String(hy));
    }
  });
}

/** A pointer position as a spot in the frame (output px from its center), from the overlay's box. */
export function framePoint(
  frame: Element,
  size: { width: number; height: number },
  clientX: number,
  clientY: number,
) {
  const box = frame.getBoundingClientRect();
  return {
    x: ((clientX - box.left) / box.width) * size.width - size.width / 2,
    y: ((clientY - box.top) / box.height) * size.height - size.height / 2,
  };
}
