import { blinkPreset } from "./blink";
import { clockPreset } from "./clock";
import { irisPreset } from "./iris";
import { pushPreset } from "./push";
import { shakePreset } from "./shake";
import { slidePreset } from "./slide";
import { spinPreset } from "./spin";
import { zoomPreset } from "./zoom";
import { splitPreset } from "./split";
import { crossDissolvePreset } from "./crossDissolve";
import { dissolvePreset } from "./dissolve";
import { fadePreset } from "./fade";
import { glarePreset } from "./glare";
import { glitchPreset } from "./glitch";
import { wipePreset } from "./wipe";
import { wooshPreset } from "./woosh";
import { variantOf } from "../transition.points";

/** The built-in transition presets, each routine followed by its variants, in the order the Transitions tab lists them. */
export const builtInPresets = [
  fadePreset,
  variantOf(fadePreset, "dip-white", "Dip to white", { color: "#ffffff" }),
  crossDissolvePreset,
  dissolvePreset,
  wipePreset,
  variantOf(wipePreset, "wipe-down", "Top to bottom", { direction: "down" }),
  clockPreset,
  irisPreset,
  variantOf(irisPreset, "iris-close", "Circle close", { direction: "in" }),
  splitPreset,
  variantOf(splitPreset, "split-v", "Split vertical", { direction: "vertical" }),
  pushPreset,
  variantOf(pushPreset, "push-right", "Push right", { direction: "right" }),
  variantOf(pushPreset, "push-up", "Push up", { direction: "up" }),
  variantOf(pushPreset, "push-down", "Push down", { direction: "down" }),
  slidePreset,
  variantOf(slidePreset, "slide-up", "Slide up", { direction: "up" }),
  zoomPreset,
  variantOf(zoomPreset, "zoom-out", "Zoom out", { direction: "out" }),
  spinPreset,
  variantOf(spinPreset, "spin-ccw", "Spin left", { direction: "ccw" }),
  shakePreset,
  glarePreset,
  blinkPreset,
  wooshPreset,
  variantOf(wooshPreset, "woosh-up", "Woosh up", { direction: "up" }),
  glitchPreset,
  variantOf(glitchPreset, "rgb-split", "RGB split", { slices: 0 }),
];
