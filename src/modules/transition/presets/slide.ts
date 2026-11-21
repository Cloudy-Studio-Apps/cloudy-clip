// WebKitGTK spike not run; a drawn still, b drawn shifted over it with drawImage (ruling R1).
import { prop } from "@/modules/element";
import { directionOffset } from "../logic/direction";
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
    // b starts a full frame away.
    const [x, y] = directionOffset(props.direction, width, height, eased(props, progress) - 1);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(a, 0, 0, width, height);
    ctx.drawImage(b, x, y, width, height);
    ctx.restore();
  },
});
