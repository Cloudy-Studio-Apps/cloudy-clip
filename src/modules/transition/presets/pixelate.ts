// WebKitGTK spike not run; the cut picture drawn into a small scratch canvas and scaled back up unsmoothed (ruling R1).
import { clamp01, bump } from "../logic/easing";
import { defineTransitionPreset } from "../transition.points";
import { ghostCanvas } from "./presets.cache";
import { drawOnly } from "./presets.mask";
import { intensityProp } from "./presets.props";

/** a turns into big blocks, cuts to b by the middle, and b sharpens again; intensity is the block size at the cut. */
export const pixelatePreset = defineTransitionPreset({
  id: "pixelate",
  name: "Pixelate",
  category: "distort",
  properties: { intensity: intensityProp() },
  defaults: () => ({ intensity: 0.6 }),
  mix(ctx, a, b, progress, props) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const source = progress < 0.5 ? a : b;
    const k = 1 + 63 * clamp01(Number(props.intensity ?? 0.6)) * bump(progress);
    const w = Math.max(1, Math.round(width / k));
    const h = Math.max(1, Math.round((height * w) / width));
    const small = ghostCanvas(ctx.canvas, width, height);
    if (!small) return drawOnly(ctx, source);
    small.ctx.save();
    small.ctx.globalCompositeOperation = "copy";
    small.ctx.globalAlpha = 1;
    small.ctx.imageSmoothingEnabled = false;
    small.ctx.drawImage(source, 0, 0, w, h);
    small.ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small.canvas, 0, 0, w, h, 0, 0, width, height);
    ctx.restore();
  },
});
