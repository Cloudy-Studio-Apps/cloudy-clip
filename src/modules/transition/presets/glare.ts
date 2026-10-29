import { prop } from "@/modules/element";
import { bump } from "../logic/easing";
import { withAlpha } from "../logic/color";
import { defineTransitionPreset } from "../transition.points";

/** A cut at the middle under a radial flash and a diagonal streak, both added with `lighter`. */
export const glarePreset = defineTransitionPreset({
  id: "glare",
  name: "Glare",
  category: "overlay",
  properties: { color: prop.color() },
  defaults: () => ({ color: "#ffffff" }),
  mix(ctx, a, b, progress, props) {
    const { width, height } = ctx.canvas;
    const color = String(props.color ?? "#ffffff");
    const flash = bump(progress);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(progress < 0.5 ? a : b, 0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    const radius = Math.hypot(width, height) * 0.6;
    const radial = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      radius,
    );
    radial.addColorStop(0, withAlpha(color, flash));
    radial.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
    // Diagonal streak sweeping across the frame.
    // Skewed space: x = x' + 0.6 y, so the band is sheared into a diagonal.
    const center = -0.3 * width - 0.6 * height + progress * (1.6 * width + 0.6 * height);
    const half = width * 0.12;
    const streak = ctx.createLinearGradient(center - half, 0, center + half, 0);
    streak.addColorStop(0, withAlpha(color, 0));
    streak.addColorStop(0.5, withAlpha(color, 0.6 * flash));
    streak.addColorStop(1, withAlpha(color, 0));
    ctx.transform(1, 0, 0.6, 1, 0, 0);
    ctx.fillStyle = streak;
    ctx.fillRect(-width, 0, width * 3, height);
    ctx.restore();
  },
});
