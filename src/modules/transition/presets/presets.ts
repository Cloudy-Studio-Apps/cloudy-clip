import { crossDissolvePreset } from "./crossDissolve";
import { dissolvePreset } from "./dissolve";
import { fadePreset } from "./fade";
import { glarePreset } from "./glare";
import { glitchPreset } from "./glitch";
import { variantOf } from "../transition.points";
import { wipePreset } from "./wipe";
import { wooshPreset } from "./woosh";

/** The built-in transition presets, each routine followed by its variants, in the order the Transitions tab lists them. */
export const builtInPresets = [
  fadePreset,
  variantOf(fadePreset, "dip-white", "Dip to white", { color: "#ffffff" }),
  crossDissolvePreset,
  dissolvePreset,
  wipePreset,
  variantOf(wipePreset, "wipe-down", "Top to bottom", { direction: "down" }),
  glarePreset,
  wooshPreset,
  variantOf(wooshPreset, "woosh-up", "Woosh up", { direction: "up" }),
  glitchPreset,
  variantOf(glitchPreset, "rgb-split", "RGB split", { slices: 0 }),
];
