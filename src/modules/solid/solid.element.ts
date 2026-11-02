import { Square } from "lucide-react";
import {
  DEFAULT_GRADIENT,
  defineElement,
  gradientPaint,
  prop,
  type DrawEnv,
} from "@/modules/element";

import type { SolidFill } from "./solid.types";

const FILL_TYPES = ["color", "gradient"] as const;

function drawSolid(ctx: CanvasRenderingContext2D, fill: SolidFill, env: DrawEnv): void {
  const { placement: place, kx, ky } = env;
  ctx.save();
  ctx.setTransform(kx, 0, 0, ky, 0, 0);
  ctx.translate(place.cx, place.cy);
  ctx.rotate((place.rotation * Math.PI) / 180);
  ctx.fillStyle =
    fill.fillType === "gradient"
      ? gradientPaint(ctx, fill.gradient, place.width, place.height)
      : fill.color;
  ctx.fillRect(-place.width / 2, -place.height / 2, place.width, place.height);
  ctx.restore();
}

const side = (label: string) =>
  prop.number({ min: 1, max: 16384, unit: "px", label, keyframes: false });

/**
 * A flat colour or gradient on the timeline. It holds its own copy, so removing the library solid
 * leaves it. A clip that stores no size follows its composition's frame.
 */
export const solidElement = defineElement({
  kind: "solid",
  name: "Solid color",
  source: "none",
  tracks: ["video"],
  supports: { transform: true, composite: true },
  properties: {
    fillType: prop.enum(FILL_TYPES, {
      label: "Fill",
      labels: { color: "Color", gradient: "Gradient" },
    }),
    color: prop.color({ visibleWhen: (values) => values.fillType === "color" }),
    gradient: prop.gradient({ visibleWhen: (values) => values.fillType === "gradient" }),
    width: side("W"),
    height: side("H"),
  },
  layout: [
    { title: "Fill", items: ["fillType", "color", "gradient"] },
    { title: "Size", items: [{ row: ["width", "height"], label: "Size" }] },
  ],
  defaults: (format) => ({
    fillType: "color" as const,
    color: "#000000",
    gradient: { ...DEFAULT_GRADIENT },
    width: format.width,
    height: format.height,
  }),
  display: () => ({ icon: Square, color: "clip-type", label: "Solid color", body: "none" }),
  picture: {
    fit: "none",
    size: (props) => ({ width: Number(props.width), height: Number(props.height) }),
    draw: (ctx, props, env) => drawSolid(ctx, props, env),
    followsFrame: (clip) => clip.props.width === undefined && clip.props.height === undefined,
  },
});
