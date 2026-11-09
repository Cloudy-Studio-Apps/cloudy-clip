import { curvePath } from "../../logic/color/curves";
import type { CurvePoint, CurveShape } from "../../tint.types";

/** The class of a point's dot. */
const DOT =
  "pointer-events-none absolute size-2.5 -translate-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_var(--background)]";

/**
 * Draws a curve straight into the DOM, without React (rule 24): the path's `d` over a 100 × 100
 * view box, and one dot per point in `dots`, made or dropped to match.
 */
export function paintCurve(
  path: SVGPathElement,
  dots: HTMLElement,
  points: readonly CurvePoint[],
  shape: CurveShape,
): void {
  path.setAttribute("d", curvePath(points, 100, 100, shape === "hue"));
  while (dots.children.length < points.length) {
    const dot = document.createElement("span");
    dot.className = DOT;
    dots.appendChild(dot);
  }
  while (dots.children.length > points.length) dots.lastElementChild!.remove();
  points.forEach(([x, y], i) => {
    const dot = dots.children[i] as HTMLElement;
    dot.style.left = `${x * 100}%`;
    dot.style.top = `${(1 - y) * 100}%`;
  });
}
