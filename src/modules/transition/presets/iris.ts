// WebKitGTK spike not run; b through a radial-gradient mask with destination-in (ruling R1).
import { prop } from "@/modules/element";
import { defineTransitionPreset } from "../transition.points";
import { clamp01, eased } from "../logic/easing";
import { easeProp, softnessProp } from "./presets.props";
import { drawOnly, revealThrough } from "./presets.mask";

/** A circle growing from the centre to reveal b (`out`), or shrinking over b to hide a (`in`). */
export const irisPreset = defineTransitionPreset({
  id: "iris-open",
  name: "Circle open",
  family: "Circle",
  category: "basic",
  properties: {
    direction: prop.enum(["in", "out"]),
    softness: softnessProp(),
    ease: easeProp(),
  },
  defaults: () => ({ direction: "out", softness: 0.15, ease: "ease" }),
  mix(ctx, a, b, progress, props) {
    const p = clamp01(eased(props, progress));
    if (p <= 0) return drawOnly(ctx, a);
    if (p >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const s = clamp01(Number(props.softness ?? 0.15));
    const inward = props.direction === "in";
    const q = inward ? 1 - p : p; // radius progress of the circle
    const reach = Math.hypot(width, height) / 2;
    const outer = Math.max(1e-3, q * reach * (1 + s));
    const inner = Math.max(0, outer - s * reach);
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      outer,
    );
    // `in` shows b outside the circle, so the alphas swap.
    gradient.addColorStop(clamp01(inner / outer), inward ? "rgba(0,0,0,0)" : "rgba(0,0,0,1)");
    gradient.addColorStop(1, inward ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)");
    revealThrough(ctx, a, b, gradient);
  },
});
