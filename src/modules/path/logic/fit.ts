import type { PathPoint } from "@/modules/project";

type Vec = { x: number; y: number };
type Cubic = [Vec, Vec, Vec, Vec];

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const len = (a: Vec) => Math.hypot(a.x, a.y);
const unit = (a: Vec): Vec => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : mul(a, 1 / l);
};

function at([p0, p1, p2, p3]: Cubic, t: number): Vec {
  const u = 1 - t;
  return add(
    add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)),
    add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)),
  );
}

function slope([p0, p1, p2, p3]: Cubic, t: number): Vec {
  const u = 1 - t;
  return add(
    add(mul(sub(p1, p0), 3 * u * u), mul(sub(p2, p1), 6 * u * t)),
    mul(sub(p3, p2), 3 * t * t),
  );
}

function bend([p0, p1, p2, p3]: Cubic, t: number): Vec {
  return add(
    mul(add(sub(p2, mul(p1, 2)), p0), 6 * (1 - t)),
    mul(add(sub(p3, mul(p2, 2)), p1), 6 * t),
  );
}

/** Each point's share of the way along the polyline from `first` to `last`. */
function chordParams(d: readonly Vec[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1]! + len(sub(d[i]!, d[i - 1]!)));
  const total = u[u.length - 1]!;
  return u.map((v) => (total === 0 ? 0 : v / total));
}

/** The cubic with the given end tangents closest to the points, by least squares. */
function leastSquares(
  d: readonly Vec[],
  first: number,
  last: number,
  u: readonly number[],
  t1: Vec,
  t2: Vec,
): Cubic {
  const p0 = d[first]!;
  const p3 = d[last]!;
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  u.forEach((t, i) => {
    const s = 1 - t;
    const a0 = mul(t1, 3 * s * s * t);
    const a1 = mul(t2, 3 * s * t * t);
    c00 += dot(a0, a0);
    c01 += dot(a0, a1);
    c11 += dot(a1, a1);
    const rest = sub(
      d[first + i]!,
      add(mul(p0, s * s * s + 3 * s * s * t), mul(p3, 3 * s * t * t + t * t * t)),
    );
    x0 += dot(a0, rest);
    x1 += dot(a1, rest);
  });
  const det = c00 * c11 - c01 * c01;
  let left = det === 0 ? 0 : (x0 * c11 - x1 * c01) / det;
  let right = det === 0 ? 0 : (c00 * x1 - c01 * x0) / det;
  const span = len(sub(p3, p0));
  if (left < span * 1e-6 || right < span * 1e-6) left = right = span / 3;
  return [p0, add(p0, mul(t1, left)), add(p3, mul(t2, right)), p3];
}

/** The farthest point from the curve and how far it is. */
function worst(d: readonly Vec[], first: number, last: number, curve: Cubic, u: readonly number[]) {
  let error = 0;
  let split = Math.floor((first + last) / 2);
  for (let i = first + 1; i < last; i++) {
    const e = len(sub(at(curve, u[i - first]!), d[i]!));
    if (e > error) {
      error = e;
      split = i;
    }
  }
  return { error, split };
}

/** `u` moved toward each point's nearest place on the curve (one Newton step each). */
function refine(d: readonly Vec[], first: number, curve: Cubic, u: readonly number[]): number[] {
  return u.map((t, i) => {
    const off = sub(at(curve, t), d[first + i]!);
    const d1 = slope(curve, t);
    const d2 = bend(curve, t);
    const den = dot(d1, d1) + dot(off, d2);
    return den === 0 ? t : Math.min(1, Math.max(0, t - dot(off, d1) / den));
  });
}

function fitRange(
  d: readonly Vec[],
  first: number,
  last: number,
  t1: Vec,
  t2: Vec,
  tolerance: number,
  out: Cubic[],
): void {
  const p0 = d[first]!;
  const p3 = d[last]!;
  if (last - first === 1) {
    const third = len(sub(p3, p0)) / 3;
    out.push([p0, add(p0, mul(t1, third)), add(p3, mul(t2, third)), p3]);
    return;
  }
  let u = chordParams(d, first, last);
  let curve = leastSquares(d, first, last, u, t1, t2);
  let { error, split } = worst(d, first, last, curve, u);
  for (let i = 0; i < 20 && error > tolerance && error < tolerance * 4; i++) {
    u = refine(d, first, curve, u);
    curve = leastSquares(d, first, last, u, t1, t2);
    ({ error, split } = worst(d, first, last, curve, u));
  }
  if (error <= tolerance) {
    out.push(curve);
    return;
  }
  const middle = unit(sub(d[split - 1]!, d[split + 1]!));
  fitRange(d, first, split, t1, middle, tolerance, out);
  fitRange(d, split, last, mul(middle, -1), t2, tolerance, out);
}

/**
 * A freehand stroke as a few smooth path points (Schneider's Bézier fitting): the curve stays
 * within `tolerance` (output px) of every point, splitting where it can't, with the handles at
 * each split in line. Points closer than half a pixel are merged first; fewer than two distinct
 * points give none.
 */
export function fitStroke(stroke: readonly Vec[], tolerance: number): PathPoint[] {
  const d: Vec[] = [];
  for (const p of stroke) {
    const last = d[d.length - 1];
    if (!last || len(sub(p, last)) >= 0.5) d.push({ x: p.x, y: p.y });
  }
  if (d.length < 2) return [];
  const curves: Cubic[] = [];
  const n = d.length - 1;
  fitRange(d, 0, n, unit(sub(d[1]!, d[0]!)), unit(sub(d[n - 1]!, d[n]!)), tolerance, curves);
  const points: PathPoint[] = curves.map(([p0, c1]) => ({
    x: p0.x,
    y: p0.y,
    inX: 0,
    inY: 0,
    outX: c1.x - p0.x,
    outY: c1.y - p0.y,
  }));
  const end = d[n]!;
  points.push({ x: end.x, y: end.y, inX: 0, inY: 0, outX: 0, outY: 0 });
  curves.forEach(([, , c2, p3], i) => {
    const next = points[i + 1]!;
    next.inX = c2.x - p3.x;
    next.inY = c2.y - p3.y;
  });
  return points;
}
