// WebKitGTK spike not run; a drawn still, b drawn shifted over it with drawImage (ruling R1).
import { prop } from "@/modules/element";
import { eased } from "../logic/easing";
import { defineTransitionPreset } from "../transition.points";
import { drawOnly } from "./presets.mask";
import { easeProp } from "./presets.props";

/** a stays still while b slides in over it from the opposite edge of the direction. */
export const slidePreset = defineTransitionPreset({
  id: "slide-left",
  name: "Slide left",
  family: "Slide",
  category: "motion",
  properties: {
    direction: prop.enum(["left", "right", "up", "down"]),
    ease: easeProp(),
  },
  defaults: () => ({ direction: "left", ease: "snap" }),
  mix(ctx, a, b, progress, props) {
    if (progress <= 0) return drawOnly(ctx, a);
    if (progress >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const vertical = props.direction === "up" || props.direction === "down";
    const sign = props.direction === "right" || props.direction === "down" ? 1 : -1;
    const size = vertical ? height : width;
    const offset = (eased(props, progress) - 1) * size * sign; // b starts a full frame away
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(a, 0, 0, width, height);
    ctx.drawImage(b, vertical ? 0 : offset, vertical ? offset : 0, width, height);
    ctx.restore();
  },
});
