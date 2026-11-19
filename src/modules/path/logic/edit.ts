import type { PathPoint } from "@/modules/project";

type Vec = { x: number; y: number };

/** Which part of a point a drag moves: the point itself (its handles travel with it) or a handle. */
export type PointPart = "point" | "in" | "out";

const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** The four control points of segment `i` (the closing one when `i` is the last point). */
function controls(points: readonly PathPoint[], i: number): [Vec, Vec, Vec, Vec] {
  const a = points[i]!;
  const b = points[(i + 1) % points.length]!;
  return [
    { x: a.x, y: a.y },
    { x: a.x + a.outX, y: a.y + a.outY },
    { x: b.x + b.inX, y: b.y + b.inY },
    { x: b.x, y: b.y },
  ];
}

/** Segment `i` at `t`. */
export function segmentAt(points: readonly PathPoint[], i: number, t: number): Vec {
  const [p0, p1, p2, p3] = controls(points, i);
  return lerp(
    lerp(lerp(p0, p1, t), lerp(p1, p2, t), t),
    lerp(lerp(p1, p2, t), lerp(p2, p3, t), t),
    t,
  );
}

/** How many segments a path has: one fewer than its points, or as many when closed. */
export function segmentCount(points: readonly PathPoint[], closed: boolean): number {
  return points.length < 2 ? 0 : closed ? points.length : points.length - 1;
}

/** The points with point `i` (or one of its handles) moved by `dx`, `dy`. */
export function movePart(
  points: readonly PathPoint[],
  i: number,
  part: PointPart,
  dx: number,
  dy: number,
  broken: boolean,
): PathPoint[] {
  return points.map((p, j) => {
    if (j !== i) return p;
    if (part === "point") return { ...p, x: p.x + dx, y: p.y + dy };
    const [mine, other] = part === "out" ? (["out", "in"] as const) : (["in", "out"] as const);
    const hx = p[`${mine}X`] + dx;
    const hy = p[`${mine}Y`] + dy;
    const moved = { ...p, [`${mine}X`]: hx, [`${mine}Y`]: hy };
    if (broken) return moved;
    // The other handle turns to stay in line, keeping its own length.
    const length = Math.hypot(p[`${other}X`], p[`${other}Y`]);
    const reach = Math.hypot(hx, hy);
    if (length === 0 || reach === 0) return moved;
    return {
      ...moved,
      [`${other}X`]: (-hx / reach) * length,
      [`${other}Y`]: (-hy / reach) * length,
    };
  });
}

/** The points with one added on segment `i` at `t`, splitting its curve so the shape stays the same. */
export function insertPoint(points: readonly PathPoint[], i: number, t: number): PathPoint[] {
  const [p0, p1, p2, p3] = controls(points, i);
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const ab = lerp(a, b, t);
  const bc = lerp(b, c, t);
  const at = lerp(ab, bc, t);
  const next = (i + 1) % points.length;
  const out = points.map((p, j) => {
    if (j === i) return { ...p, outX: a.x - p0.x, outY: a.y - p0.y };
    if (j === next) return { ...p, inX: c.x - p3.x, inY: c.y - p3.y };
    return p;
  });
  const added: PathPoint = {
    x: at.x,
    y: at.y,
    inX: ab.x - at.x,
    inY: ab.y - at.y,
    outX: bc.x - at.x,
    outY: bc.y - at.y,
  };
  out.splice(i + 1, 0, added);
  return out;
}

/** The points without point `i`; unchanged when that would leave fewer than two. */
export function removePoint(points: readonly PathPoint[], i: number): PathPoint[] {
  return points.length <= 2 ? [...points] : points.filter((_, j) => j !== i);
}

/** The place on the path nearest to `to`: its segment, `t` on it and how far it is. */
export function nearestOnPath(
  points: readonly PathPoint[],
  closed: boolean,
  to: Vec,
): { segment: number; t: number; distance: number } {
  let best = { segment: 0, t: 0, distance: Infinity };
  for (let s = 0; s < segmentCount(points, closed); s++) {
    for (let k = 0; k <= 64; k++) {
      const at = segmentAt(points, s, k / 64);
      const distance = Math.hypot(at.x - to.x, at.y - to.y);
      if (distance < best.distance) best = { segment: s, t: k / 64, distance };
    }
  }
  return best;
}

/** An SVG path `d` for the points, in their own space (output px from the frame's center). */
export function pathData(points: readonly PathPoint[], closed: boolean): string {
  const first = points[0];
  if (!first) return "";
  let d = `M${first.x},${first.y}`;
  for (let s = 0; s < segmentCount(points, closed); s++) {
    const [, c1, c2, end] = controls(points, s);
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`;
  }
  return closed ? `${d} Z` : d;
}
