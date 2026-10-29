import { prop } from "@/modules/element";
import { blockGrid } from "../logic/grid";
import { defineTransitionPreset } from "../transition.points";
import { dissolveCanvas } from "./presets.cache";
import { maskableSurface } from "./presets.mask";

/** b is revealed through a seeded block mask whose threshold is the progress. */
export const dissolvePreset = defineTransitionPreset({
  id: "dissolve",
  name: "Dissolve",
  category: "basic",
  properties: { grain: prop.number({ min: 0, max: 1, step: 0.01, control: "slider" }) },
  defaults: () => ({ grain: 0.5 }),
  mix(ctx, a, b, progress, props, env) {
    const { width, height } = ctx.canvas;
    const grain = Math.min(1, Math.max(0, Number(props.grain ?? 0.5)));
    // Fine grain = small blocks (4 output px), coarse = large (64 output px).
    const { block, cols, rows } = blockGrid(
      width,
      height,
      (64 - 60 * grain) * Math.max(env.kx, env.ky),
    );
    const small = dissolveCanvas(ctx.canvas, cols, rows, `dissolve-${env.random()}`, progress);
    const { surface, mask: m } = maskableSurface(b, width, height);
    if (small) {
      m.save();
      m.globalCompositeOperation = "destination-in";
      m.globalAlpha = 1;
      m.imageSmoothingEnabled = false;
      m.drawImage(small, 0, 0, cols, rows, 0, 0, cols * block, rows * block);
      m.restore();
    }
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(a, 0, 0, width, height);
    ctx.drawImage(surface, 0, 0, width, height);
    ctx.restore();
  },
});
