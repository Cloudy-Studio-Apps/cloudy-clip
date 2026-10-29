// WebKitGTK spike not run; uses red/blue lighter channel split and seeded slice offsets without ctx.filter (ruling R1).
import { prop } from "@/modules/element";
import { bump } from "../logic/easing";
import { seededRandom } from "../logic/noise";
import { defineTransitionPreset } from "../transition.points";

/** A cut at the middle; around it, seeded horizontal slice offsets and a red/blue split. */
export const glitchPreset = defineTransitionPreset({
  id: "glitch",
  name: "Glitch",
  category: "glitch",
  properties: { intensity: prop.number({ min: 0, max: 1, step: 0.01, control: "slider" }) },
  defaults: () => ({ intensity: 0.6 }),
  mix(ctx, a, b, progress, props, env) {
    const { width, height } = ctx.canvas;
    const intensity = Math.min(1, Math.max(0, Number(props.intensity ?? 0.6)));
    const amount = intensity * bump(progress);
    const source = progress < 0.5 ? a : b;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (amount < 0.02) {
      ctx.drawImage(source, 0, 0, width, height);
      ctx.restore();
      return;
    }
    // The pattern changes ~12 times a second and is stable for a given junction and moment.
    const random = seededRandom(`glitch-${env.random()}-${Math.floor(env.elapsed * 12)}`);
    const slices = Math.ceil(4 + 12 * amount);
    ctx.drawImage(source, 0, 0, width, height);
    for (let i = 0; i < slices; i++) {
      const h = Math.max(2, Math.round(height * (0.01 + random() * 0.06)));
      const y = Math.floor(random() * (height - h));
      const dx = (random() * 2 - 1) * width * 0.12 * amount;
      ctx.drawImage(source, 0, y, width, h, dx, y, width, h);
    }
    // Red and blue ghosts: the picture, multiplied to one channel, added back with an offset.
    const tmp = document.createElement("canvas");
    tmp.width = width;
    tmp.height = height;
    const t = tmp.getContext("2d");
    if (t) {
      const split = width * 0.02 * amount;
      const ghosts: [string, number][] = [
        ["#ff0000", -split],
        ["#0000ff", split],
      ];
      for (const [color, dx] of ghosts) {
        t.globalCompositeOperation = "source-over";
        t.drawImage(source, 0, 0, width, height);
        t.globalCompositeOperation = "multiply";
        t.fillStyle = color;
        t.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.6 * amount;
        ctx.drawImage(tmp, dx, 0);
      }
    }
    ctx.restore();
  },
});
