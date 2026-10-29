/** One choice of a `SegmentedControl`. */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Tooltip, e.g. what an aspect ratio is for. */
  hint?: string;
}

/** A color as hue (0–360), saturation and value (0–1). */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** Tells a change handler whether a gesture is over: drag steps are `done: false`, the release, a typed hex or a swatch pick are `done: true`. */
export interface ColorChangeInfo {
  done: boolean;
}

/** A pointer position inside an element, each axis 0–1. */
export interface DragPosition {
  x: number;
  y: number;
}
