import { DEFAULT_CORRECTION } from "@/modules/project";
import type { LookDef } from "./tint.types";

const { creative } = DEFAULT_CORRECTION;

/** The looks that come with Tint, contributed to `tintLooks` as a plugin's would be. */
export const BUILTIN_LOOKS: readonly LookDef[] = [
  {
    id: "tint.golden-hour",
    name: "Golden hour",
    note: "Warm low sun: amber highlights, a little glow",
    corrections: [
      { name: "Warmth", values: { temperature: 30, tint: 4, exposure: 0.12, saturation: 1.08 } },
      {
        name: "Glow",
        values: {
          creative: { ...creative, highlightTint: { x: 0.4, y: -0.7 }, balance: 20, fade: 4 },
        },
      },
    ],
  },
  {
    id: "tint.teal-orange",
    name: "Teal and orange",
    note: "Teal shadows, orange highlights, a bit more contrast",
    corrections: [
      { name: "Contrast", values: { contrast: 1.1, saturation: 1.1 } },
      {
        name: "Split",
        values: {
          creative: {
            ...creative,
            shadowTint: { x: 0, y: 0.8 },
            highlightTint: { x: 0.4, y: -0.7 },
          },
        },
      },
    ],
  },
  {
    id: "tint.bleach-bypass",
    name: "Bleach bypass",
    note: "Washed colors, hard contrast, a gritty film",
    corrections: [
      { name: "Colors", values: { saturation: 0.55 } },
      { name: "Contrast", values: { contrast: 1.3, highlights: -10, blacks: -8 } },
    ],
  },
  {
    id: "tint.soft-film",
    name: "Soft film",
    note: "Lifted blacks, gentle contrast, a faint vignette",
    corrections: [
      { name: "Tone", values: { contrast: 0.92, highlights: -15, saturation: 0.92 } },
      {
        name: "Film",
        values: {
          creative: {
            ...creative,
            shadowTint: { x: 0, y: 0.35 },
            highlightTint: { x: 0.3, y: -0.5 },
            fade: 22,
            vignette: { amount: -20, midpoint: 50, roundness: 0, feather: 70 },
          },
        },
      },
    ],
  },
  {
    id: "tint.night-blue",
    name: "Night blue",
    note: "Cool, dim and a little desaturated",
    corrections: [
      { name: "Cool", values: { exposure: -0.5, temperature: -45, saturation: 0.75 } },
      {
        name: "Moonlight",
        values: {
          contrast: 1.1,
          creative: { ...creative, shadowTint: { x: -0.7, y: 0.4 } },
        },
      },
    ],
  },
  {
    id: "tint.mono",
    name: "Mono",
    note: "Black and white with a little punch",
    corrections: [{ name: "Black and white", values: { saturation: 0, contrast: 1.15 } }],
  },
];
