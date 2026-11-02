import { Square } from "lucide-react";
import { defineElement, prop, type DrawEnv } from "@/modules/element";

function drawSolid(ctx: CanvasRenderingContext2D, color: string, env: DrawEnv): void {
  const { placement: place, kx, ky } = env;
  ctx.save();
  ctx.setTransform(kx, 0, 0, ky, 0, 0);
  ctx.translate(place.cx, place.cy);
  ctx.rotate((place.rotation * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.fillRect(-place.width / 2, -place.height / 2, place.width, place.height);
  ctx.restore();
}

/** A flat colour on the timeline. It holds its own copy, so removing the library solid leaves it. */
export const solidElement = defineElement({
  kind: "solid",
  name: "Solid color",
  source: "none",
  tracks: ["video"],
  supports: { transform: true, composite: true },
  properties: {
    color: prop.color(),
    width: prop.number({ min: 1, max: 16384, hidden: true }),
    height: prop.number({ min: 1, max: 16384, hidden: true }),
  },
  defaults: () => ({ color: "#000000", width: 1920, height: 1080 }),
  display: () => ({ icon: Square, color: "clip-type", label: "Solid color", body: "none" }),
  picture: {
    fit: "none",
    size: (props) => ({ width: Number(props.width), height: Number(props.height) }),
    draw: (ctx, props, env) => drawSolid(ctx, String(props.color), env),
  },
});
