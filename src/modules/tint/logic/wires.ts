import type { GraphPoint as Point } from "../tint.types";

/** An SVG path for a wire from an output port to an input port: a horizontal S-curve. */
export function wirePath([x1, y1]: Point, [x2, y2]: Point): string {
  const reach = Math.max(30, Math.abs(x2 - x1) / 2);
  return `M${x1} ${y1}C${x1 + reach} ${y1} ${x2 - reach} ${y2} ${x2} ${y2}`;
}
