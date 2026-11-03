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

/** The curve sampled into an SVG path over a `width × height` box (y up). */
export function curvePath(points: readonly CurvePoint[], width: number, height: number): string {
  const curve = monotoneCurve(points);
  const steps = 64;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const y = Math.min(1, Math.max(0, curve(x)));
    d += `${i === 0 ? "M" : "L"}${(x * width).toFixed(1)} ${((1 - y) * height).toFixed(1)}`;
  }
  return d;
}
