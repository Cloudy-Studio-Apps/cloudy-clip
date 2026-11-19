import type {
  BezierSegment as Segment,
  MotionPath,
  PathLengthTable as LengthTable,
  PathPoint,
  PathSample,
  Vec2 as Vec,
} from "../project.types";

/** Samples per segment for the length table. */
const STEPS = 32;

const tables = new WeakMap<MotionPath, LengthTable>();

function segmentsOf(path: MotionPath): Segment[] {
  const { points } = path;
  const join = (a: PathPoint, b: PathPoint): Segment => [
    { x: a.x, y: a.y },
    { x: a.x + a.outX, y: a.y + a.outY },
    { x: b.x + b.inX, y: b.y + b.inY },
    { x: b.x, y: b.y },
  ];
  const out: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i++) out.push(join(points[i]!, points[i + 1]!));
  if (path.closed && points.length > 1) out.push(join(points[points.length - 1]!, points[0]!));
  return out;
}

function bezier([p0, p1, p2, p3]: Segment, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function tableOf(path: MotionPath): LengthTable {
  const cached = tables.get(path);
  if (cached) return cached;
  const segments = segmentsOf(path);
  const lengths: number[][] = [];
  let total = 0;
  for (const segment of segments) {
    const row = [total];
    let last = segment[0];
    for (let i = 1; i <= STEPS; i++) {
      const here = bezier(segment, i / STEPS);
      total += Math.hypot(here.x - last.x, here.y - last.y);
      row.push(total);
      last = here;
    }
    lengths.push(row);
  }
  const table = { segments, lengths, total };
  tables.set(path, table);
  return table;
}

/** The length of a path in output pixels. */
export function pathLength(path: MotionPath): number {
  return tableOf(path).total;
}

/** The segment and its own `t` at a distance along the path. */
function locate(table: LengthTable, distance: number): { segment: Segment; t: number } {
  const { segments, lengths } = table;
  for (let s = 0; s < segments.length; s++) {
    const row = lengths[s]!;
    if (distance > row[STEPS]! && s < segments.length - 1) continue;
    for (let i = 1; i <= STEPS; i++) {
      if (distance <= row[i]! || i === STEPS) {
        const from = row[i - 1]!;
        const span = row[i]! - from;
        const within = span > 0 ? Math.min(1, Math.max(0, (distance - from) / span)) : 0;
        return { segment: segments[s]!, t: (i - 1 + within) / STEPS };
      }
    }
  }
  return { segment: segments[segments.length - 1]!, t: 1 };
}

/**
 * Where a path is at `progress`, by distance along it (so equal steps cover equal length): its
 * point and its direction. An open path holds its ends outside 0..1; a closed one wraps. A path
 * of no length gives its first point, pointing right.
 */
export function pathPointAt(path: MotionPath, progress: number): PathSample {
  const table = tableOf(path);
  const first = path.points[0];
  if (!first || table.total === 0) return { x: first?.x ?? 0, y: first?.y ?? 0, angle: 0 };
  const p = path.closed ? ((progress % 1) + 1) % 1 : Math.min(1, Math.max(0, progress));
  const { segment, t } = locate(table, p * table.total);
  const at = bezier(segment, t);
  // A difference rather than the derivative, which vanishes at a corner with no handles.
  const ahead = bezier(segment, Math.min(1, t + 0.001));
  const behind = bezier(segment, Math.max(0, t - 0.001));
  const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
  return { x: at.x, y: at.y, angle };
}
