// WebKitGTK spike not run; a and b side by side in a scratch canvas, blurred along the move by a GPU pass (ruling R1).
import { prop } from "@/modules/element";
import { directionOffset, isVertical } from "../logic/direction";
import { bump, clamp01, eased } from "../logic/easing";
import { directionalBlurPass } from "../logic/gpu";
import { defineTransitionPreset } from "../transition.points";
import { drawOnly } from "./presets.mask";
import { drawBlurred } from "./presets.blur";
import { easeProp, intensityProp } from "./presets.props";

/** Blur length at full intensity and peak speed, in frame heights. */
const MAX_BLUR = 0.08;

/**
 * The pair a and b side by side slides across the frame (a leaves, b arrives from the opposite
 * edge). Intensity is a motion blur along the move, strongest mid-way; it needs the GPU, so
 * without one the move is drawn unblurred. The ease may overshoot.
 */
export const pushPreset = defineTransitionPreset({
  id: "push-left",
  name: "Push left",
  family: "Push",
  category: "motion",
  properties: {
    direction: prop.enum(["left", "right", "up", "down"]),
    ease: easeProp(),
    intensity: intensityProp(),
  },
  defaults: () => ({ direction: "left", ease: "ease", intensity: 0.5 }),
  mix(ctx, a, b, progress, props, env) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const shift = eased(props, progress);
    const length = clamp01(Number(props.intensity ?? 0.5)) * bump(progress) * MAX_BLUR;
    const blur = length > 1e-4;
    const dir: [number, number] = isVertical(props.direction) ? [0, 1] : [1, 0];
    const at = (amount: number) => directionOffset(props.direction, width, height, amount);
    drawBlurred(ctx, env, blur, directionalBlurPass(-1, dir, length), (target) => {
      target.drawImage(a, ...at(shift), width, height);
      target.drawImage(b, ...at(shift - 1), width, height);
    });
  },
});
