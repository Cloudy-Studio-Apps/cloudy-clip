import type { CorrectionValues } from "@/modules/project";
import { WARP_HUES, WARP_RINGS } from "../../logic/color/warper";
import { screenOf, warpedPlaces } from "../../logic/color/warper.edit";
import type { WarpShapes } from "./tools.types";

/** The grid's SVG view box (`size` square, centered on 0) and where strength 1 sits. */
export const WARP_VIEW = { size: 240, radius: 108 } as const;

/**
 * Draws the grid as `warper` moves it, straight into the DOM without React (rule 24): every point
 * where it sits now (stored, following or pinned), the rings and hue lines through them. A stored
 * point is filled with the mark color, a pinned one is hollow.
 */
export function paintWarp(shapes: WarpShapes, warper: CorrectionValues["warper"]): void {
  const at = warpedPlaces(warper).map((place) => screenOf(place, WARP_VIEW.radius));
  const xy = (i: number) => `${at[i]!.x.toFixed(2)},${at[i]!.y.toFixed(2)}`;
  shapes.rings.forEach((ring, r) => {
    const points = Array.from({ length: WARP_HUES }, (_, k) => xy(r * WARP_HUES + k));
    ring.setAttribute("points", points.join(" "));
  });
  shapes.spokes.forEach((spoke, k) => {
    const points = Array.from({ length: WARP_RINGS }, (_, r) => xy(r * WARP_HUES + k));
    spoke.setAttribute("points", ["0,0", ...points].join(" "));
  });
  const pinned = new Set(warper.pinned);
  shapes.dots.forEach((dot, i) => {
    dot.setAttribute("cx", at[i]!.x.toFixed(2));
    dot.setAttribute("cy", at[i]!.y.toFixed(2));
    const fill = pinned.has(i)
      ? "var(--background)"
      : warper.points[i]
        ? "var(--mark)"
        : "var(--foreground)";
    dot.setAttribute("fill", fill);
    dot.setAttribute("stroke", pinned.has(i) ? "var(--foreground)" : "var(--background)");
  });
}
