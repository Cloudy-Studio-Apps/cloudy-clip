// WebKitGTK spike not run; a cross dissolve under three drifting radial gradients added with lighter (ruling R1).
import { prop } from "@/modules/element";
import { bump, clamp01, easeInOutCubic } from "../logic/easing";
import { withAlpha } from "../logic/color";
import { defineTransitionPreset } from "../transition.points";
import { drawDissolve, drawOnly } from "./presets.mask";
import { intensityProp } from "./presets.props";

const BLOBS = 3;

/**
 * a dissolves into b while soft blobs of `color` drift across the frame, added with `lighter`;
 * the glow peaks at the cut. Blob places come from the junction's seeded random, drawn the same
 * number of times every frame.
 */
export const leakPreset = defineTransitionPreset({
  id: "light-leak",
  name: "Light leak",
  family: "Light leak",
  category: "light",
  properties: { color: prop.color(), intensity: intensityProp() },
  defaults: () => ({ color: "#ffb347", intensity: 0.7 }),
  mix(ctx, a, b, progress, props, env) {
    // Drawn first so the random sequence is identical on every frame.
    const blobs = Array.from({ length: BLOBS }, () => ({
      x: env.random(),
      y: env.random(),
      dx: env.random() - 0.5,
      r: 0.6 + 0.4 * env.random(),
    }));
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    drawDissolve(ctx, a, b, easeInOutCubic(progress));
    const color = String(props.color ?? "#ffb347");
    const k = clamp01(Number(props.intensity ?? 0.7)) * bump(progress);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;
    for (const blob of blobs) {
      const x = (blob.x + blob.dx * (progress - 0.5) * 2) * width;
      const y = blob.y * height;
      const radius = blob.r * Math.max(width, height) * 0.6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, withAlpha(color, clamp01(k)));
      g.addColorStop(0.5, withAlpha(color, clamp01(k * 0.4)));
      g.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  },
});
