// WebKitGTK spike not run; b through a symmetric linear-gradient band with destination-in (ruling R1).
import { prop } from "@/modules/element";
import { defineTransitionPreset } from "../transition.points";
import { clamp01, eased } from "../logic/easing";
import { easeProp, softnessProp } from "./presets.props";
import { drawOnly, revealThrough } from "./presets.mask";

/** Barn doors: b shows in a centred band that grows to full (`open`), or at the edges closing in (`close`). */
export const splitPreset = defineTransitionPreset({
  id: "split-h",
  name: "Split",
  family: "Split",
  category: "basic",
  properties: {
    direction: prop.enum(["horizontal", "vertical"]),
    mode: prop.enum(["open", "close"], { label: "Mode" }),
    softness: softnessProp(),
    ease: easeProp(),
  },
  defaults: () => ({ direction: "horizontal", mode: "open", softness: 0.1, ease: "ease" }),
  mix(ctx, a, b, progress, props) {
    const p = clamp01(eased(props, progress));
    if (p <= 0) return drawOnly(ctx, a);
    if (p >= 1) return drawOnly(ctx, b);
    const { width, height } = ctx.canvas;
    const soft = clamp01(Number(props.softness ?? 0.1)) * 0.5; // edge width, in half-axis units
    const closing = props.mode === "close";
    const q = closing ? 1 - p : p; // growth of the centred band
    const edge = q * (0.5 + soft);
    const inner = Math.max(0, edge - soft);
    const gradient =
      props.direction === "vertical"
        ? ctx.createLinearGradient(0, 0, 0, height)
        : ctx.createLinearGradient(0, 0, width, 0);
    // `close` shows b outside the band, so the alphas swap.
    const hidden = closing ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)";
    const shown = closing ? "rgba(0,0,0,0)" : "rgba(0,0,0,1)";
    gradient.addColorStop(clamp01(0.5 - edge), hidden);
    gradient.addColorStop(clamp01(0.5 - inner), shown);
    gradient.addColorStop(clamp01(0.5 + inner), shown);
    gradient.addColorStop(clamp01(0.5 + edge), hidden);
    revealThrough(ctx, a, b, gradient);
  },
});
