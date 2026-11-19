import type { Micros } from "@/core";
import {
  maskOutline,
  writeKey,
  trackValue,
  type Clip,
  type ClipMask,
  type KeyTrack,
  type MaskId,
  type MaskShape,
  type PathPoint,
  type PointId,
} from "@/modules/project";

/** The six numbers of a path point, in the order they are keyed. */
export const POINT_COORDS = ["x", "y", "inX", "inY", "outX", "outY"] as const;

/** The key path of a point's coordinate. */
export const pointPath = (maskId: MaskId, pointId: PointId, coord: string) =>
  `masks.${maskId}.shape.points.${pointId}.${coord}`;

/** Sorted, distinct key times of the clip's tracks whose path passes `test`. */
function keyTimes(clip: Clip, test: (path: string) => boolean): Micros[] {
  const times = Object.entries(clip.animation ?? {}).flatMap(([path, track]) =>
    test(path) ? track.keys.map((key) => key.t) : [],
  );
  return [...new Set(times)].sort((a, b) => a - b);
}

/** Content times of every key under `masks.<id>.shape.points.` and on `masks.<id>.shape.scale`. */
export function pathKeyTimes(clip: Clip, maskId: MaskId): Micros[] {
  const points = `masks.${maskId}.shape.points.`;
  return keyTimes(clip, (p) => p.startsWith(points) || p === `masks.${maskId}.shape.scale`);
}

/** Content times of every key of a mask's shape numbers (`masks.<id>.shape.*`). */
export const shapeKeyTimes = (clip: Clip, maskId: MaskId) =>
  keyTimes(clip, (p) => p.startsWith(`masks.${maskId}.shape.`));

/** A value at content time `t`: its track's, or `stored` when it has none. */
function valueAt(clip: Clip, path: string, t: Micros, stored: number): number {
  const track = clip.animation?.[path];
  return track && track.keys.length > 0 ? Number(trackValue(track, t)) : stored;
}

/** The points of a path mask in `order` at content time `t` (stored values where unkeyed). */
export function pointsAt(clip: Clip, maskId: MaskId, order: readonly PointId[], t: Micros) {
  const shape = clip.masks![maskId]!.shape as Extract<MaskShape, { kind: "path" }>;
  return order.map((pid) => {
    const stored = shape.points[pid]!;
    const point = { ...stored };
    for (const c of POINT_COORDS) point[c] = valueAt(clip, pointPath(maskId, pid, c), t, stored[c]);
    return point;
  });
}

/** A preset mask's shape at content time `t`. */
export function shapeAt(clip: Clip, mask: ClipMask, t: Micros): MaskShape {
  const shape: Record<string, unknown> = { ...mask.shape };
  for (const [k, v] of Object.entries(shape)) {
    if (typeof v === "number") shape[k] = valueAt(clip, `masks.${mask.id}.shape.${k}`, t, v);
  }
  return shape as MaskShape;
}

/**
 * A preset shape's outline as path points relative to the mask's center (rotation stays on the
 * mask), or null for linear and mirror. Segments of no length (a sharp rectangle's corner arcs)
 * are kept so every time gives the same count; `dropFlat` removes them from all times at once.
 */
export function outlinePoints(mask: ClipMask, shape: MaskShape): PathPoint[] | null {
  const segments = maskOutline({ ...mask, shape, x: 0, y: 0, rotation: 0 });
  return (
    segments?.map(([p, out], i) => {
      const prev = segments[(i + segments.length - 1) % segments.length]!;
      return {
        x: p.x,
        y: p.y,
        inX: prev[2].x - p.x,
        inY: prev[2].y - p.y,
        outX: out.x - p.x,
        outY: out.y - p.y,
      };
    }) ?? null
  );
}

/** Whether point `i`'s segment to the next point has no length. */
function flat(points: readonly PathPoint[], i: number): boolean {
  const p = points[i]!;
  const q = points[(i + 1) % points.length]!;
  return p.x === q.x && p.y === q.y && !p.outX && !p.outY && !q.inX && !q.inY;
}

/** The shapes (one per time, same count) without the segments that have no length in all of them. */
export function dropFlat(shapes: PathPoint[][]): PathPoint[][] {
  const first = shapes[0]!;
  const gone = first.map((_, i) => shapes.every((points) => flat(points, i)));
  return shapes.map((points) => {
    const kept = points.map((p) => ({ ...p }));
    // The next point inherits the removed one's in-handle, so the curve before it stays.
    kept.forEach((p, i) => {
      if (gone[i]) Object.assign(kept[(i + 1) % kept.length]!, { inX: p.inX, inY: p.inY });
    });
    return kept.filter((_, i) => !gone[i]);
  });
}

/** Writes a key of `value` at content time `t` on `path` in `animation`, making the track if needed. */
export function keyInto(
  animation: Record<string, KeyTrack>,
  path: string,
  t: Micros,
  value: number,
  tolerance: Micros,
): void {
  const track = animation[path] ?? { shared: true, blend: "number", keys: [] };
  animation[path] = writeKey(track, t, value, tolerance);
}
