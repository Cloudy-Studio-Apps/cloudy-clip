/** A layout edge the user can drag: the side panel, the inspector, or the timeline. */
export type ResizableArea = "side" | "inspector" | "timeline";

/** How one area resizes. */
export interface ResizeRule {
  /** CSS variable on the layout grid that holds the size in px. */
  cssVar: string;
  min: number;
  /** Upper bound in px; a function when it depends on the window. */
  max: number | (() => number);
  /** `x` resizes a column (width), `y` a row (height). */
  axis: "x" | "y";
  /** +1 when dragging right/down grows the area, -1 when it shrinks it. */
  sign: 1 | -1;
}

/** Sizes the user chose, in px. A missing area uses its default. */
export type PanelSizes = Partial<Record<ResizableArea, number>>;
