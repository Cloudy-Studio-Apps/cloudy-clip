import { easeInOutCubic } from "../logic/easing";
import { defineTransitionPreset } from "../transition.points";
import { drawDissolve } from "./presets.mask";

/** a, then b over it with an eased alpha. */
export const crossDissolvePreset = defineTransitionPreset({
  id: "cross-dissolve",
  name: "Cross dissolve",
  category: "basic",
  properties: {},
  defaults: () => ({}),
  mix(ctx, a, b, progress) {
    drawDissolve(ctx, a, b, easeInOutCubic(progress));
  },
});
