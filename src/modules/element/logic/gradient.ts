import { z } from "zod";
import type { Gradient, GradientStop } from "@/modules/project";

const unit = z.number().min(0).max(1);

/** A whole gradient: 2 to 8 stops. Colors are stored lowercase, as `color` values are. */
export const gradientSchema = z.strictObject({
  type: z.enum(["linear", "radial"]),
  angle: z.number().min(-3600).max(3600),
  stops: z
    .array(
      z.strictObject({
        at: unit,
        color: z
          .string()
          .toLowerCase()
          .regex(/^#[0-9a-f]{6}$/, "Use #rrggbb"),
        opacity: unit,
      }),
    )
    .min(2)
    .max(8),
});

/** What a new gradient starts as. */
export const DEFAULT_GRADIENT: Readonly<Gradient> = Object.freeze({
  type: "linear",
  angle: 0,
  stops: [
    { at: 0, color: "#f2a385", opacity: 1 },
    { at: 1, color: "#8cc4f0", opacity: 1 },
  ],
});

function stopColor({ color, opacity }: GradientStop): string {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

/**
 * The line of a linear gradient on a box of this size centered on the origin. `angle` is clockwise
 * in degrees, 0 running left to right; the ends reach the box's corners.
 */
export function gradientLine(
  { angle }: Gradient,
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const half = (Math.abs(width * cos) + Math.abs(height * sin)) / 2;
  return { x0: -cos * half, y0: -sin * half, x1: cos * half, y1: sin * half };
}

/** A canvas paint of the gradient, for a box of this size centered on the origin. */
export function gradientPaint(
  ctx: CanvasRenderingContext2D,
  gradient: Gradient,
  width: number,
  height: number,
): CanvasGradient {
  const { x0, y0, x1, y1 } = gradientLine(gradient, width, height);
  const paint =
    gradient.type === "linear"
      ? ctx.createLinearGradient(x0, y0, x1, y1)
      : ctx.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(width, height) / 2);
  for (const stop of gradient.stops) paint.addColorStop(stop.at, stopColor(stop));
  return paint;
}

/** The gradient as a CSS background, for tiles and the text editor. */
export function gradientCss(gradient: Gradient): string {
  const stops = [...gradient.stops]
    .sort((a, b) => a.at - b.at)
    .map((stop) => `${stopColor(stop)} ${stop.at * 100}%`)
    .join(", ");
  return gradient.type === "linear"
    ? `linear-gradient(${gradient.angle + 90}deg, ${stops})`
    : `radial-gradient(circle farthest-corner, ${stops})`;
}
