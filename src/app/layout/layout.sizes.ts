import type { PanelSizes, ResizableArea, ResizeRule } from "./layout.types";

/** Height of the top bar, in px. */
export const TOP_BAR_HEIGHT = 48;
/** The preview keeps at least this much height when the timeline grows. */
const MIN_PREVIEW_HEIGHT = 220;

/** Limits of each resizable area. Defaults live in the grid template of `LayoutHost`. */
export const RESIZE_RULES: Record<ResizableArea, ResizeRule> = {
  side: { cssVar: "--side-w", min: 274, max: 600, axis: "x", sign: 1 },
  inspector: { cssVar: "--inspector-w", min: 280, max: 560, axis: "x", sign: -1 },
  timeline: {
    cssVar: "--timeline-h",
    min: 140,
    max: () => window.innerHeight - TOP_BAR_HEIGHT - MIN_PREVIEW_HEIGHT,
    axis: "y",
    sign: -1,
  },
};

const STORAGE_KEY = "cloudy-clip:panel-sizes";

/** Keeps a size inside its rule's limits. */
export function clampSize(rule: ResizeRule, size: number): number {
  const max = typeof rule.max === "function" ? rule.max() : rule.max;
  return Math.round(Math.min(Math.max(rule.min, max), Math.max(rule.min, size)));
}

/** Sizes saved by a previous session. Empty when storage is blocked or the value is invalid. */
export function readPanelSizes(): PanelSizes {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    const sizes: PanelSizes = {};
    for (const area of Object.keys(RESIZE_RULES) as ResizableArea[]) {
      const value = (parsed as Record<string, unknown>)[area];
      if (typeof value === "number" && Number.isFinite(value)) sizes[area] = value;
    }
    return sizes;
  } catch {
    return {};
  }
}

/** Remembers the sizes for the next session. Does nothing when storage is blocked. */
export function savePanelSizes(sizes: PanelSizes): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Storage blocked: sizes just won't be remembered.
  }
}
