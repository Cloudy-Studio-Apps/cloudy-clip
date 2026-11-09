import { hueOf } from "../../logic/color/curves.apply";
import type { Rgb } from "../../tint.types";

const NAMED: readonly [string, Rgb][] = [
  ["red", [1, 0, 0]],
  ["#ff0", [1, 1, 0]],
  ["lime", [0, 1, 0]],
  ["cyan", [0, 1, 1]],
  ["blue", [0, 0, 1]],
  ["#f0f", [1, 0, 1]],
];

/**
 * Gradient stops of the hue circle (data colors), each color where the hue curves and the warper
 * read its hue (`hueOf`, red at 0 %), back to red at 100 %. For a strip or a disc of hues.
 */
export const HUE_STOPS = [
  ...NAMED.map(([css, rgb]) => `${css} ${((hueOf(rgb) ?? 0) * 100).toFixed(1)}%`),
  "red 100%",
].join(", ");
