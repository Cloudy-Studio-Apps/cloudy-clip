import { prop } from "@/modules/element";
import { defineTransitionPreset } from "../transition.points";
import { maskableSurface } from "./presets.mask";

/** b over a through a moving linear-gradient mask. */
export const wipePreset = defineTransitionPreset({
  id: "wipe",
  name: "Left to right",
  category: "basic",
  properties: {
    direction: prop.enum(["left", "right", "up", "down"]),
    softness: prop.number({ min: 0, max: 1, step: 0.01, control: "slider" }),
  },
  defaults: () => ({ direction: "right", softness: 0.3 }),
  mix(ctx, a, b, progress, props) {
    const { width, height } = ctx.canvas;
    const direction = String(props.direction ?? "right");
    const s = Math.min(1, Math.max(0, Number(props.softness ?? 0.3)));
    // The edge travels along the axis from `from` to `to`.
    const horizontal = direction === "left" || direction === "right";
    const forward = direction === "right" || direction === "down";
    const length = horizontal ? width : height;
    // The gradient line spans u in [-s, 1+s] of the axis, so the soft edge never gets squeezed.
    const dx = horizontal ? (forward ? 1 : -1) : 0;
    const dy = horizontal ? 0 : forward ? 1 : -1;
    const ox = horizontal ? (forward ? 0 : width) : 0;
    const oy = horizontal ? 0 : forward ? 0 : height;
    const at = (u: number): [number, number] => [ox + dx * u * length, oy + dy * u * length];
    const [gx0, gy0] = at(-s);
    const [gx1, gy1] = at(1 + s);
    const end = progress * (1 + s); // the edge's far side, as a fraction of the axis
    const offset = (u: number) => (u + s) / (1 + 2 * s);
    const gradient = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    gradient.addColorStop(offset(end - s), "rgba(0,0,0,1)");
    gradient.addColorStop(Math.min(1, offset(end) + 1e-6), "rgba(0,0,0,0)");
    const { surface, mask } = maskableSurface(b, width, height);
    mask.save();
    mask.globalCompositeOperation = "destination-in";
    mask.globalAlpha = 1;
    mask.fillStyle = gradient;
    mask.fillRect(0, 0, width, height);
    mask.restore();
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(a, 0, 0, width, height);
    ctx.drawImage(surface, 0, 0, width, height);
    ctx.restore();
  },
});
