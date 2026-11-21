// WebKitGTK spike not run; b clipped to a pie path, a wider pie at half alpha for the soft edge (ruling R1).
import { prop } from "@/modules/element";
import { defineTransitionPreset } from "../transition.points";
import { clamp01, eased } from "../logic/easing";
import { easeProp, softnessProp } from "./presets.props";
import { drawOnly } from "./presets.mask";

/** b revealed by a pie sweeping from 12 o'clock by 2π·progress. */
export const clockPreset = defineTransitionPreset({
  id: "clock",
  name: "Clock wipe",
  category: "basic",
  properties: {
    direction: prop.enum(["cw", "ccw"]),
    softness: softnessProp(),
    ease: easeProp(),
  },
  defaults: () => ({ direction: "cw", softness: 0.05, ease: "linear" }),
  mix(ctx, a, b, progress, props) {
    const p = clamp01(eased(props, progress));
    if (p <= 0) return drawOnly(ctx, a);
    if (p >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const s = clamp01(Number(props.softness ?? 0.05));
    const ccw = props.direction === "ccw";
    const radius = Math.hypot(width, height);
    drawOnly(ctx, a);
    const layer = (sweep: number, alpha: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      const end = -Math.PI / 2 + (ccw ? -sweep : sweep);
      ctx.arc(width / 2, height / 2, radius, -Math.PI / 2, end, ccw);
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha = alpha;
      ctx.drawImage(b, 0, 0, width, height);
      ctx.restore();
    };
    // The soft edge grows from nothing and shrinks back, so it doesn't pop in at either end.
    const soft = s * Math.PI * Math.sin(Math.PI * p);
    if (soft > 0) layer(Math.min(2 * Math.PI, 2 * Math.PI * p + soft), 0.5);
    layer(2 * Math.PI * p, 1);
  },
});
