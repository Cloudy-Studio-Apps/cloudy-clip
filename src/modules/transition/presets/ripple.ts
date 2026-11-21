// WebKitGTK spike not run; both pictures rippled by GPU passes and cross dissolved in a third (ruling R1).
import { clamp01, bump } from "../logic/easing";
import { drawGpu, mixPass, ripplePass } from "../logic/gpu";
import { defineTransitionPreset } from "../transition.points";
import { drawDissolve, drawOnly } from "./presets.mask";
import { intensityProp } from "./presets.props";

/** Rings spread from the center and bend both pictures while a dissolves into b; the ripple peaks at the cut. Needs the GPU, else a cross dissolve with a slight scale. */
export const ripplePreset = defineTransitionPreset({
  id: "ripple",
  name: "Ripple",
  category: "distort",
  properties: { intensity: intensityProp() },
  defaults: () => ({ intensity: 0.5 }),
  mix(ctx, a, b, progress, props, env) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const amount = clamp01(Number(props.intensity ?? 0.5)) * bump(progress) * 0.03;
    if (!env.gpu) {
      if (amount > 0) env.withoutGpu();
      // A cross dissolve with a slight scale about the center.
      const { width, height } = ctx.canvas;
      const scale = 1 + 0.03 * bump(progress);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-width / 2, -height / 2);
      drawDissolve(ctx, a, b, progress);
      ctx.restore();
      return;
    }
    const phase = progress * 20;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawGpu(
      ctx,
      env.gpu,
      [a, b],
      [
        ripplePass(-1, [0.5, 0.5], amount, phase),
        ripplePass(-2, [0.5, 0.5], amount, phase),
        mixPass(0, 1, progress),
      ],
    );
    ctx.restore();
  },
});
