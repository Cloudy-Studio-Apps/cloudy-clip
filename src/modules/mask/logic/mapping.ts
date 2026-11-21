import {
  maskPlacement,
  type ClipTransform,
  type MaskMapping,
  type PathPoint,
  type PictureSize,
  type ProjectFormat,
  type Vec2,
} from "@/modules/project";
import type { MaskPlace } from "../mask.types";

/**
 * A clip's `maskPlacement` with its center moved to the frame's center, so `toFrame` gives the
 * frame px from the center the path gestures and the overlay's SVG use (the engine's is from the
 * top-left).
 */
export function frameMapping(
  format: ProjectFormat,
  size: PictureSize,
  transform: ClipTransform,
): MaskMapping {
  const m = maskPlacement(format, size, transform);
  return { ...m, cx: m.cx - format.width / 2, cy: m.cy - format.height / 2 };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** `v` turned by `deg` degrees, clockwise on screen (y down). */
export function turn(v: Vec2, deg: number): Vec2 {
  const cos = Math.cos(rad(deg));
  const sin = Math.sin(rad(deg));
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** An offset in mask space as an offset in the frame (no translation: handles, directions). */
export const vecToFrame = (m: MaskMapping, v: Vec2): Vec2 =>
  turn({ x: v.x * m.sx, y: v.y * m.sy }, m.rotation);

/** An offset in the frame as an offset in mask space. */
export function vecToMask(m: MaskMapping, v: Vec2): Vec2 {
  const q = turn(v, -m.rotation);
  return { x: q.x / m.sx, y: q.y / m.sy };
}

/** A point in mask space as a point in the frame (output px from its center, with `frameMapping`). */
export function toFrame(m: MaskMapping, p: Vec2): Vec2 {
  const v = vecToFrame(m, p);
  return { x: v.x + m.cx, y: v.y + m.cy };
}

/** A point in the frame (output px from its center) as a point in mask space. */
export const toMask = (m: MaskMapping, p: Vec2): Vec2 =>
  vecToMask(m, { x: p.x - m.cx, y: p.y - m.cy });

/** Whether the mapping can be inverted (a picture scaled to nothing can't be edited). */
export const invertible = (m: MaskMapping) => m.sx !== 0 && m.sy !== 0;

/** A point of a mask's own shape (relative to its x/y, unrotated) in mask space. */
export function placeLocal(place: MaskPlace, l: Vec2): Vec2 {
  const v = turn(l, place.rotation);
  return { x: v.x + place.x, y: v.y + place.y };
}

/** A point in mask space in a mask's own shape coordinates (the inverse of `placeLocal`). */
export const toLocal = (place: MaskPlace, p: Vec2): Vec2 =>
  turn({ x: p.x - place.x, y: p.y - place.y }, -place.rotation);

/** How many output px one mask px along `dir` (in the mask's own axes) covers in the frame. */
export function frameLength(m: MaskMapping, place: MaskPlace, dir: Vec2): number {
  const v = vecToFrame(m, turn(dir, place.rotation));
  return Math.hypot(v.x, v.y) || 1;
}

/** A path mask's points (relative to its x/y, before `scale`) in frame px, handles as frame offsets. */
export function pointsToFrame(
  m: MaskMapping,
  place: MaskPlace,
  scale: number,
  points: readonly PathPoint[],
): PathPoint[] {
  return points.map((p) => {
    const at = toFrame(m, placeLocal(place, { x: p.x * scale, y: p.y * scale }));
    const handle = (x: number, y: number) =>
      vecToFrame(m, turn({ x: x * scale, y: y * scale }, place.rotation));
    const i = handle(p.inX, p.inY);
    const o = handle(p.outX, p.outY);
    return { x: at.x, y: at.y, inX: i.x, inY: i.y, outX: o.x, outY: o.y };
  });
}

/** Frame points back into a path mask's own points (the inverse of `pointsToFrame`). */
export function pointsToMask(
  m: MaskMapping,
  place: MaskPlace,
  scale: number,
  points: readonly PathPoint[],
): PathPoint[] {
  return points.map((p) => {
    const at = toLocal(place, toMask(m, p));
    const handle = (x: number, y: number) => {
      const v = turn(vecToMask(m, { x, y }), -place.rotation);
      return { x: v.x / scale, y: v.y / scale };
    };
    const i = handle(p.inX, p.inY);
    const o = handle(p.outX, p.outY);
    return { x: at.x / scale, y: at.y / scale, inX: i.x, inY: i.y, outX: o.x, outY: o.y };
  });
}
