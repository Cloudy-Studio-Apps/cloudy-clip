// WebKitGTK spike not run; the cut picture scaled about the center in a scratch canvas, radially blurred by a GPU pass (ruling R1).
import { prop } from "@/modules/element";
import { bump, clamp01, eased } from "../logic/easing";
import { zoomBlurPass } from "../logic/gpu";
import { defineTransitionPreset } from "../transition.points";
import { drawOnly } from "./presets.mask";
import { drawBlurred, drawStacked } from "./presets.blur";
import { drawMoved } from "./presets.camera";
import { easeProp, intensityProp } from "./presets.props";

/** The picture's scale at progress `p`: the camera keeps moving through the cut (b starts at the inverse of a's end scale); the peak blur hides the jump. */
function scaleAt(props: Record<string, unknown>, p: number): number {
  const intensity = clamp01(Number(props.intensity ?? 0.6));
  const end = props.direction === "out" ? 1 / (1 + intensity) : 1 + intensity;
  const s = end ** clamp01(2 * eased(props, Math.min(p, 1 - p)));
  return p < 0.5 ? s : 1 / s;
}

/**
 * A pushes in (or out) to the middle, then b settles from the same scale to 1. Intensity is the
 * zoom depth and a radial blur, strongest at the cut; the blur needs the GPU, so without one the
 * zoom is drawn unblurred.
 */
export const zoomPreset = defineTransitionPreset({
  id: "zoom-in",
  name: "Zoom in",
  family: "Zoom",
  category: "camera",
  properties: {
    direction: prop.enum(["in", "out"]),
    ease: easeProp(),
    intensity: intensityProp(),
  },
  defaults: () => ({ direction: "in", ease: "ease", intensity: 0.6 }),
  mix(ctx, a, b, progress, props, env) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const scale = scaleAt(props, progress);
    const strength = 0.35 * clamp01(Number(props.intensity ?? 0.6)) * bump(progress);
    drawBlurred(ctx, env, strength > 1e-4, zoomBlurPass(-1, [0.5, 0.5], strength), (target) =>
      drawMoved(target, progress < 0.5 ? a : b, scale, 0),
    );
  },
  thumbnail(ctx, a, b, progress, props) {
    const scale = scaleAt(props, progress);
    drawStacked(ctx, (i) => drawMoved(ctx, progress < 0.5 ? a : b, scale ** (1 + i * 0.25), 0));
  },
});
