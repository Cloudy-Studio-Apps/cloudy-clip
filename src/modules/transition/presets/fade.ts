import { prop } from "@/modules/element";
import { defineTransitionPreset } from "../transition.points";

/** a fades to a color by the middle, then the color fades to b. */
export const fadePreset = defineTransitionPreset({
  id: "fade",
  name: "Fade",
  category: "basic",
  properties: { color: prop.color() },
  defaults: () => ({ color: "#000000" }),
  mix(ctx, a, b, progress, props) {
    const { width, height } = ctx.canvas;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(progress < 0.5 ? a : b, 0, 0, width, height);
    ctx.globalAlpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    ctx.fillStyle = String(props.color ?? "#000000");
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
});
