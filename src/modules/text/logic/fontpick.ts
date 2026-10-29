import { closestVariant, type FontFamily, type FontVariant } from "@/modules/fonts";
import type { FontWeight } from "@/modules/project";

const ALL_WEIGHTS: FontWeight[] = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

/** The face to use in `family` for what the text has now: the same face when it exists, else the closest. */
export function pickVariant(family: FontFamily | undefined, want: FontVariant): FontVariant {
  if (!family) return want;
  const exact = family.variants.some((v) => v.weight === want.weight && v.style === want.style);
  return exact ? want : closestVariant(family, want);
}

/** The weights a family has, ascending; all nine while the family is not known. */
export function availableWeights(family: FontFamily | undefined): FontWeight[] {
  if (!family || family.variants.length === 0) return ALL_WEIGHTS;
  return ALL_WEIGHTS.filter((w) => family.variants.some((v) => v.weight === w));
}

/** Whether the family has italic faces (true while it is not known). */
export function hasItalic(family: FontFamily | undefined): boolean {
  return !family || family.variants.some((v) => v.style === "italic");
}

/** The rows `[start, end)` to render for a scroll offset: the viewport plus `overscan` rows each side. */
export function visibleWindow(
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  count: number,
  overscan: number,
): { start: number; end: number } {
  const first = Math.floor(scrollTop / rowHeight);
  const last = Math.ceil((scrollTop + viewport) / rowHeight);
  return { start: Math.max(0, first - overscan), end: Math.min(count, last + overscan) };
}
