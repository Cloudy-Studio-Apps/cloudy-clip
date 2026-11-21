// WebKitGTK spike not run; the cut picture turned about the center in a scratch canvas, blurred round by a GPU pass (ruling R1).
import { prop } from "@/modules/element";
import { bump, clamp01, eased } from "../logic/easing";
import { spinBlurPass } from "../logic/gpu";
import { defineTransitionPreset } from "../transition.points";
import { drawOnly } from "./presets.mask";
import { drawBlurred, drawMoved, drawStacked } from "./presets.blur";
import { easeProp, intensityProp } from "./presets.props";

/** The picture's turn at progress `p`: a quarter turn at the cut, mirrored after it. */
function angleAt(props: Record<string, unknown>, p: number): number {
  const sign = props.direction === "ccw" ? -1 : 1;
  const turn = (Math.PI / 2) * clamp01(eased(props, p < 0.5 ? p * 2 : (1 - p) * 2));
  return p < 0.5 ? sign * turn : -sign * turn;
}

/**
 * A turns a quarter turn about the center, then b turns back to upright. The picture grows a
 * little at the cut; intensity is a rotational blur, strongest there. The blur needs the GPU, so
 * without one the turn is drawn unblurred.
 */
export const spinPreset = defineTransitionPreset({
  id: "spin",
  name: "Spin",
  family: "Spin",
  category: "camera",
  properties: {
    direction: prop.enum(["cw", "ccw"]),
    ease: easeProp(),
    intensity: intensityProp(),
  },
  defaults: () => ({ direction: "cw", ease: "ease", intensity: 0.6 }),
  mix(ctx, a, b, progress, props, env) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const angle = clamp01(Number(props.intensity ?? 0.6)) * bump(progress) * 0.6;
    drawBlurred(ctx, env, angle > 1e-4, spinBlurPass(-1, [0.5, 0.5], angle), (target) =>
      drawMoved(target, progress < 0.5 ? a : b, 1 + 0.1 * bump(progress), angleAt(props, progress)),
    );
  },
  thumbnail(ctx, a, b, progress, props) {
    const scale = 1 + 0.1 * bump(progress);
    const turn = angleAt(props, progress);
    drawStacked(ctx, (i) => drawMoved(ctx, progress < 0.5 ? a : b, scale, turn * (1 - i * 0.12)));
  },
});
