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
