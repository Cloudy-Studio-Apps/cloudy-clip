import type { DemoField, DemoWheel } from "./demo.types";

const f = (label: string, value: number, min: number, max: number, step = 1): DemoField => ({
  label,
  value,
  min,
  max,
  step,
});

/** Basics of the selected layer. */
export const DEMO_LIGHT: readonly DemoField[] = [
  f("Exposure", 0, -4, 4, 0.01),
  f("Contrast", 1, 0, 2, 0.01),
  f("Highlights", 0, -100, 100),
  f("Shadows", 0, -100, 100),
  f("Whites", 0, -100, 100),
  f("Blacks", 0, -100, 100),
  f("Rolloff", 0, 0, 100),
];
export const DEMO_COLOR: readonly DemoField[] = [
  f("Temperature", 6, -100, 100, 1),
  f("Tint", 0, -100, 100, 1),
  f("Vibrance", 0, -100, 100, 1),
  f("Saturation", 1.06, 0, 2, 0.01),
];

/** The sliders beside the wheels. */
export const DEMO_PRIMARIES: readonly DemoField[] = [
  f("Temperature", 6, -100, 100, 1),
  f("Tint", 0, -100, 100, 1),
  f("Contrast", 1, 0, 2, 0.01),
  f("Pivot", 0.435, 0, 1, 0.005),
  f("Saturation", 1.06, 0, 2, 0.01),
  f("Hue", 0, -180, 180, 1),
];

const w = (label: string, base: number, x = 0, y = 0): DemoWheel => ({
  label,
  x,
  y,
  numbers: [base, base, base, base],
  master: 0,
});

export const DEMO_WHEELS: Record<"primary" | "log", readonly DemoWheel[]> = {
  primary: [w("Lift", 0), w("Gamma", 0), w("Gain", 1, 0.12, -0.08), w("Offset", 25)],
  log: [w("Shadow", 0), w("Midtone", 0), w("Highlight", 0, 0.1, -0.05), w("Offset", 25)],
};

export const DEMO_ZONES: readonly DemoWheel[] = [
  w("Black", 0),
  w("Dark", 0),
  w("Shadow", 0, -0.2, 0.15),
  w("Light", 0),
  w("Highlight", 0, 0.15, -0.1),
  w("Specular", 0),
];

/** The eight Color mix families. */
export const DEMO_FAMILIES = [
  { name: "Reds", hue: 0 },
  { name: "Oranges", hue: 30 },
  { name: "Yellows", hue: 55 },
  { name: "Greens", hue: 120 },
  { name: "Aquas", hue: 180 },
  { name: "Blues", hue: 220 },
  { name: "Purples", hue: 270 },
  { name: "Magentas", hue: 310 },
] as const;

/** Saturation of each family, 0..1, for the bar chart. */
export const DEMO_FAMILY_SAT = [0.5, 0.62, 0.5, 0.4, 0.5, 0.32, 0.5, 0.5] as const;

/** Points of the custom curve and of a hue curve, x and y in 0..1. */
export const DEMO_CURVE: readonly [number, number][] = [
  [0, 0],
  [0.3, 0.26],
  [0.72, 0.78],
  [1, 1],
];
export const DEMO_HUE_CURVE: readonly [number, number][] = [
  [0, 0.5],
  [0.08, 0.5],
  [0.14, 0.62],
  [0.22, 0.5],
  [1, 0.5],
];

/** 24-patch chart reference colors. */
export const DEMO_CHART = [
  "#735244",
  "#c29682",
  "#627a9d",
  "#576c43",
  "#8580b1",
  "#67bdaa",
  "#d67e2c",
  "#505ba6",
  "#c15a63",
  "#5e3c6c",
  "#9dbc40",
  "#e0a32e",
  "#383d96",
  "#469449",
  "#af363c",
  "#e7c71f",
  "#bb5695",
  "#0885a1",
  "#f3f3f2",
  "#c8c8c8",
  "#a0a0a0",
  "#7a7a79",
  "#555555",
  "#343434",
] as const;

/** LUTs in the LUT tab. */
export const DEMO_LUTS = [
  { name: "Golden hour", kind: "Look" },
  { name: "Soft film", kind: "Look" },
  { name: "Teal and orange", kind: "Look" },
  { name: "Grade from set.cube", kind: "Imported" },
] as const;

/** Camera color spaces. */
export const DEMO_SPACES = [
  "Rec.709",
  "sRGB",
  "Sony S-Log3 / S-Gamut3.Cine",
  "Apple Log",
  "Canon C-Log2",
  "Canon C-Log3",
  "Panasonic V-Log",
  "Fujifilm F-Log",
] as const;
