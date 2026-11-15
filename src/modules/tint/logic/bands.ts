/**
 * The bands false color paints, darkest first: each holds the luma below `below` (0..1, Rec.709
 * of the output), painted `rgb` (0..1), with the `ink` its legend label is written in. The
 * shader and the legend both read this list. A fixed palette over a picture, the one place
 * a color is hard-coded (it must mean the same on every theme).
 */
export const FALSE_COLOR_BANDS = [
  { name: "crushed", below: 0.02, rgb: [0.55, 0.1, 0.85], ink: "#eceff1" },
  { name: "shadow", below: 0.35, rgb: [0.35, 0.35, 0.35], ink: "#eceff1" },
  { name: "mid gray", below: 0.5, rgb: [0.3, 0.75, 0.35], ink: "#0e1013" },
  { name: "skin", below: 0.65, rgb: [0.95, 0.6, 0.7], ink: "#0e1013" },
  { name: "light", below: 0.9, rgb: [0.6, 0.6, 0.6], ink: "#0e1013" },
  { name: "near clip", below: 0.95, rgb: [0.95, 0.85, 0.2], ink: "#0e1013" },
  { name: "clipped", below: Infinity, rgb: [1, 0.1, 0.1], ink: "#0e1013" },
] as const;

/** Luma (0..1) from which a pixel counts as clipped: the last band, and what the warning marks. */
export const CLIP_LUMA = 0.95;
/** How much of the warning's magenta covers a clipped pixel. */
export const WARNING_STRENGTH = 0.85;
/** The warning's color. */
export const WARNING_RGB = [1, 0, 1] as const;
