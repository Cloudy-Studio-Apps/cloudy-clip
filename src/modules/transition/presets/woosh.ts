// WebKitGTK spike not run; uses a 4-pass offset smear at globalAlpha 0.25 without ctx.filter (ruling R1).
import { prop } from "@/modules/element";
import { bump, easeInOutCubic } from "../logic/easing";
import { defineTransitionPreset } from "../transition.points";

const PASSES = 4;

/** a slides out and b slides in; the motion blur is an offset smear whose spread follows the speed. */
export const wooshPreset = defineTransitionPreset({
  id: "woosh",
  name: "Woosh",
  category: "blur",
  properties: { direction: prop.enum(["left", "right"]) },
  defaults: () => ({ direction: "left" }),
  mix(ctx, a, b, progress, props) {
    const { width, height } = ctx.canvas;
    // "left": the pictures move toward the left.
    const sign = props.direction === "right" ? 1 : -1;
    const shift = easeInOutCubic(progress) * width * sign;
    const spread = bump(progress) * width * 0.08;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1 / PASSES;
    for (let i = 0; i < PASSES; i++) {
      const smear = (i / (PASSES - 1) - 0.5) * spread;
      const x = shift + smear;
      ctx.drawImage(a, x, 0, width, height);
      ctx.drawImage(b, x - width * sign, 0, width, height);
    }
    ctx.restore();
  },
});
