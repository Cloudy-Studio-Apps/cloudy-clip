import { crossDissolvePreset } from "./crossDissolve";
import { dissolvePreset } from "./dissolve";
import { fadePreset } from "./fade";
import { glarePreset } from "./glare";
import { glitchPreset } from "./glitch";
import { wipePreset } from "./wipe";
import { wooshPreset } from "./woosh";

/** The seven built-in transition presets, in the order the Transitions tab lists them. */
export const builtInPresets = [
  fadePreset,
  crossDissolvePreset,
  dissolvePreset,
  wipePreset,
  glarePreset,
  wooshPreset,
  glitchPreset,
];
