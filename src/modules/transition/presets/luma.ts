// WebKitGTK spike not run; a GPU pass reveals b through a's luma, a cross dissolve without a GPU (ruling R1).
import { prop } from "@/modules/element";
import { clamp01 } from "../logic/easing";
import { drawGpu, lumaKeyPass } from "../logic/gpu";
import { defineTransitionPreset } from "../transition.points";
import { drawDissolve, drawOnly } from "./presets.mask";
import { softnessProp } from "./presets.props";

/** b appears through a by brightness: dark areas first (or light ones first); softness feathers the edge. Needs the GPU, else a cross dissolve. */
export const lumaPreset = defineTransitionPreset({
  id: "luma-fade",
  name: "Luma fade",
  category: "distort",
  properties: { direction: prop.enum(["dark", "light"]), softness: softnessProp() },
  defaults: () => ({ direction: "dark", softness: 0.1 }),
  mix(ctx, a, b, progress, props, env) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    if (!env.gpu) {
      env.withoutGpu();
      return drawDissolve(ctx, a, b, progress);
    }
    const s = Math.max(clamp01(Number(props.softness ?? 0.1)), 1e-4);
    const pass = lumaKeyPass(-1, -2, progress * (1 + 2 * s) - s, s, props.direction === "light");
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawGpu(ctx, env.gpu, [a, b], [pass]);
    ctx.restore();
  },
});
