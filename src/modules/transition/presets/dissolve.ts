import { prop } from "@/modules/element";
import { blockMask } from "../logic/noise";
import { defineTransitionPreset } from "../transition.points";
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
    const block = Math.max(1, (64 - 60 * grain) * Math.max(env.kx, env.ky));
    const mask = blockMask(width, height, block, `dissolve-${env.random()}`);
    const cols = Math.ceil(width / block);
    const { surface, mask: m } = maskableSurface(b, width, height);
    const path = new Path2D();
    for (let i = 0; i < mask.length; i++) {
      if ((mask[i] ?? 1) < progress) {
        path.rect((i % cols) * block, Math.floor(i / cols) * block, block + 0.5, block + 0.5);
      }
    }
    m.save();
    m.globalCompositeOperation = "destination-in";
    m.globalAlpha = 1;
    m.fillStyle = "#000";
    m.fill(path);
    m.restore();
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(a, 0, 0, width, height);
    ctx.drawImage(surface, 0, 0, width, height);
    ctx.restore();
  },
});
