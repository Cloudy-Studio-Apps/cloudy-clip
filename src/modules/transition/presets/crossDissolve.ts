import { easeInOutCubic } from "../logic/easing";
import { defineTransitionPreset } from "../transition.points";

/** a, then b over it with an eased alpha. */
export const crossDissolvePreset = defineTransitionPreset({
  id: "cross-dissolve",
  name: "Cross dissolve",
  category: "basic",
  properties: {},
  defaults: () => ({}),
  mix(ctx, a, b, progress) {
    const { width, height } = ctx.canvas;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(a, 0, 0, width, height);
    ctx.globalAlpha = easeInOutCubic(progress);
    ctx.drawImage(b, 0, 0, width, height);
    ctx.restore();
  },
});
