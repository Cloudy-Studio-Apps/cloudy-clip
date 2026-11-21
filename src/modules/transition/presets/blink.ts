// WebKitGTK spike not run; two lid rects with a gradient edge over a or b (ruling R1).
import { prop } from "@/modules/element";
import { defineTransitionPreset } from "../transition.points";
import { clamp01, eased } from "../logic/easing";
import { withAlpha } from "../logic/color";
import { easeProp } from "./presets.props";
import { drawOnly } from "./presets.mask";

/** Two lids close over a by the middle and open on b. */
export const blinkPreset = defineTransitionPreset({
  id: "blink",
  name: "Blink",
  category: "light",
  properties: { color: prop.color(), ease: easeProp() },
  defaults: () => ({ color: "#000000", ease: "ease" }),
  mix(ctx, a, b, progress, props) {
    const p = clamp01(eased(props, progress));
    if (p <= 0) return drawOnly(ctx, a);
    if (p >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const color = String(props.color ?? "#000000");
    drawOnly(ctx, p < 0.5 ? a : b);
    const cover = 1 - Math.abs(2 * p - 1); // 0 open .. 1 closed
    const lid = (cover * height) / 2;
    const feather = 0.1 * height * cover; // the soft edge grows with the lids, so it is 0 when open
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, lid);
    ctx.fillRect(0, height - lid, width, lid);
    if (feather > 0) {
      const top = ctx.createLinearGradient(0, lid, 0, lid + feather);
      top.addColorStop(0, withAlpha(color, 1));
      top.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = top;
      ctx.fillRect(0, lid, width, feather);
      const bottom = ctx.createLinearGradient(0, height - lid, 0, height - lid - feather);
      bottom.addColorStop(0, withAlpha(color, 1));
      bottom.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = bottom;
      ctx.fillRect(0, height - lid - feather, width, feather);
    }
    ctx.restore();
  },
});
