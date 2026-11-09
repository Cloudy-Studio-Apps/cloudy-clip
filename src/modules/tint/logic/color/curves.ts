import type { CurvePoint } from "../../tint.types";

/**
 * A monotone cubic through the points (Fritsch–Carlson), so a curve never overshoots between two
 * points. Points must be sorted by x; outside them the curve holds the end values.
 */
export function monotoneCurve(points: readonly CurvePoint[]): (x: number) => number {
  const n = points.length;
  if (n === 0) return (x) => x;
  if (n === 1) return () => points[0]![1];
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) slopes.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]! || 1));
  const tangents = [slopes[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1]!;
    const b = slopes[i]!;
    tangents.push(a * b <= 0 ? 0 : (a + b) / 2);
  }
  tangents.push(slopes[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i]!;
    if (s === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i]! / s;
    const b = tangents[i + 1]! / s;
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangents[i] = t * a * s;
      tangents[i + 1] = t * b * s;
    }
  }
  return (x) => {
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]!) i++;
    const h = xs[i + 1]! - xs[i]!;
    const t = (x - xs[i]!) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i]! +
      (t3 - 2 * t2 + t) * h * tangents[i]! +
      (-2 * t3 + 3 * t2) * ys[i + 1]! +
      (t3 - t2) * h * tangents[i + 1]!
    );
  };
}

/**
 * A hue curve: a monotone cubic that wraps at 1, so it runs smoothly from the last point into the
 * first. The point at x 1 is the point at x 0 again (its y is not read; the editor keeps the two
 * equal). Any `hue` is taken modulo 1.
 */
export function periodicCurve(points: readonly CurvePoint[]): (hue: number) => number {
  const last = points[points.length - 1];
  const cycle = points.length > 1 && last && last[0] >= 1 ? points.slice(0, -1) : points.slice();
  if (cycle.length === 0) return () => 0.5;
  if (cycle.length === 1) return () => cycle[0]![1];
  // Two points of the turn before and after, so the tangents at the seam see their neighbours.
  const before = cycle.slice(-2).map(([x, y]): CurvePoint => [x - 1, y]);
  const after = cycle.slice(0, 2).map(([x, y]): CurvePoint => [x + 1, y]);
  const curve = monotoneCurve([...before, ...cycle, ...after]);
  return (hue) => curve(hue - Math.floor(hue));
}

/** The curve sampled into an SVG path over a `width × height` box (y up); `periodic` for a hue curve. */
export function curvePath(
  points: readonly CurvePoint[],
  width: number,
  height: number,
  periodic = false,
): string {
  const curve = periodic ? periodicCurve(points) : monotoneCurve(points);
  const steps = 128;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const y = Math.min(1, Math.max(0, curve(x)));
    d += `${i === 0 ? "M" : "L"}${(x * width).toFixed(2)} ${((1 - y) * height).toFixed(2)}`;
  }
  return d;
}
