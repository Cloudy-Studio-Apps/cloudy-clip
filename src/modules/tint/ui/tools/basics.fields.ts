import type { BasicField } from "./tools.types";

/** The Light column of Basics, in order. Ranges come from `GRADE_RANGES`. */
export const LIGHT_FIELDS: readonly BasicField[] = [
  { key: "exposure", label: "Exposure", step: 0.01 },
  { key: "contrast", label: "Contrast", step: 0.01 },
  { key: "highlights", label: "Highlights", step: 1 },
  { key: "shadows", label: "Shadows", step: 1 },
  { key: "whites", label: "Whites", step: 1 },
  { key: "blacks", label: "Blacks", step: 1 },
  { key: "rolloff", label: "Rolloff", step: 1 },
];

/** The Color column of Basics. */
export const COLOR_FIELDS: readonly BasicField[] = [
  { key: "temperature", label: "Temperature", step: 1 },
  { key: "tint", label: "Tint", step: 1 },
  { key: "vibrance", label: "Vibrance", step: 1 },
  { key: "saturation", label: "Saturation", step: 0.01 },
];

/** The sliders beside the wheels. */
export const PRIMARY_FIELDS: readonly BasicField[] = [
  { key: "temperature", label: "Temperature", step: 1 },
  { key: "tint", label: "Tint", step: 1 },
  { key: "contrast", label: "Contrast", step: 0.01 },
  { key: "pivot", label: "Pivot", step: 0.005 },
  { key: "saturation", label: "Saturation", step: 0.01 },
  { key: "hue", label: "Hue", step: 1 },
];
