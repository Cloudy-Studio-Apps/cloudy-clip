import { clipPlacement } from "../project.geometry";
import { IDENTITY_TRANSFORM } from "../project.geometry";
import type {
  BezierSegment,
  Clip,
  ClipMask,
  ClipTransform,
  MaskMapping,
  PathPoint,
  PictureSize,
  ProjectFormat,
  Vec2,
} from "../project.types";

/** Circular arc as a cubic Bézier: control distance over radius. */
const K = 0.5523;

/**
 * Where a clip's mask space sits in the frame. The space is the picture fitted at the identity
 * transform, so it depends on the picture's aspect only, never its pixel count: a proxy and its
 * master map a mask identically. A point (px, py) lands at `rotate((px*sx, py*sy), rotation) + (cx, cy)`.
 */
export function maskPlacement(
  format: ProjectFormat,
  size: PictureSize,
  transform: ClipTransform,
): MaskMapping {
  const fitted = clipPlacement(format, size, IDENTITY_TRANSFORM);
  const place = clipPlacement(format, size, transform);
  return {
    cx: place.cx,
    cy: place.cy,
    rotation: place.rotation,
    sx: ((place.flipX ? -1 : 1) * place.width) / fitted.width,
    sy: ((place.flipY ? -1 : 1) * place.height) / fitted.height,
  };
}

const line = (a: Vec2, b: Vec2): BezierSegment => [a, a, b, b];
const v = (x: number, y: number): Vec2 => ({ x, y });

function rectangle(w: number, h: number, roundness: number): BezierSegment[] {
  const hw = w / 2;
  const hh = h / 2;
  const r = (roundness * Math.min(w, h)) / 2;
  const c = r * K;
  // Clockwise from the top edge's start; each corner is one arc.
  return [
    line(v(-hw + r, -hh), v(hw - r, -hh)),
    [v(hw - r, -hh), v(hw - r + c, -hh), v(hw, -hh + r - c), v(hw, -hh + r)],
    line(v(hw, -hh + r), v(hw, hh - r)),
    [v(hw, hh - r), v(hw, hh - r + c), v(hw - r + c, hh), v(hw - r, hh)],
    line(v(hw - r, hh), v(-hw + r, hh)),
    [v(-hw + r, hh), v(-hw + r - c, hh), v(-hw, hh - r + c), v(-hw, hh - r)],
    line(v(-hw, hh - r), v(-hw, -hh + r)),
    [v(-hw, -hh + r), v(-hw, -hh + r - c), v(-hw + r - c, -hh), v(-hw + r, -hh)],
  ];
}

function ellipse(w: number, h: number): BezierSegment[] {
  const a = w / 2;
  const b = h / 2;
  return [
    [v(0, -b), v(a * K, -b), v(a, -b * K), v(a, 0)],
    [v(a, 0), v(a, b * K), v(a * K, b), v(0, b)],
    [v(0, b), v(-a * K, b), v(-a, b * K), v(-a, 0)],
    [v(-a, 0), v(-a, -b * K), v(-a * K, -b), v(0, -b)],
  ];
}

function star(w: number, h: number, points: number, inner: number): BezierSegment[] {
  const n = Math.round(points);
  const corners = Array.from({ length: 2 * n }, (_, i) => {
    const turn = -Math.PI / 2 + (i * Math.PI) / n;
    const k = i % 2 === 0 ? 1 : inner;
    return v((w / 2) * k * Math.cos(turn), (h / 2) * k * Math.sin(turn));
  });
  return corners.map((p, i) => line(p, corners[(i + 1) % corners.length]!));
}

function heart(w: number, h: number): BezierSegment[] {
  const left: BezierSegment[] = [
    [v(0, h / 2), v(-w * 0.25, h * 0.3), v(-w / 2, h * 0.15), v(-w / 2, -h * 0.1)],
    [v(-w / 2, -h * 0.1), v(-w / 2, -h * 0.35), v(-w * 0.4, -h / 2), v(-w * 0.25, -h / 2)],
    [v(-w * 0.25, -h / 2), v(-w * 0.1, -h / 2), v(0, -h * 0.4), v(0, -h * 0.25)],
  ];
  // The right half mirrors the left, walked back from the dip to the bottom point.
  const right = left.map((s) => s.map((p) => v(-p.x, p.y)).reverse() as BezierSegment).reverse();
  return [...left, ...right];
}

function drawn(shape: Extract<ClipMask["shape"], { kind: "path" }>): BezierSegment[] {
  const points = shape.pointOrder.flatMap((id) => {
    const p: PathPoint | undefined = shape.points[id];
    return p ? [p] : [];
  });
  const k = shape.scale;
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length]!;
    return [
      v(p.x * k, p.y * k),
      v((p.x + p.outX) * k, (p.y + p.outY) * k),
      v((q.x + q.inX) * k, (q.y + q.inY) * k),
      v(q.x * k, q.y * k),
    ];
  });
}

/**
 * A mask's outline as closed cubic segments in fitted picture px (shape centered at (x, y) and
 * rotated by `rotation`); null for the linear and mirror shapes, which are lines (`maskLine`).
 */
export function maskOutline(mask: ClipMask): BezierSegment[] | null {
  const s = mask.shape;
  let local: BezierSegment[];
  switch (s.kind) {
    case "rectangle":
      local = rectangle(s.width, s.height, s.roundness);
      break;
    case "ellipse":
      local = ellipse(s.width, s.height);
      break;
    case "star":
      local = star(s.width, s.height, s.points, s.inner);
      break;
    case "heart":
      local = heart(s.width, s.height);
      break;
    case "path":
      local = drawn(s);
      break;
    default:
      return null;
  }
  const turn = (mask.rotation * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const place = (p: Vec2) => v(p.x * cos - p.y * sin + mask.x, p.x * sin + p.y * cos + mask.y);
  return local.map((seg) => seg.map(place) as BezierSegment);
}

/**
 * The line of a linear or mirror mask: a point on it and its unit normal (down at rotation 0, the
 * shown side of a linear mask), with the mirror's half-width (0 for linear). Null for other shapes.
 */
export function maskLine(
  mask: ClipMask,
): { x: number; y: number; nx: number; ny: number; half: number } | null {
  const s = mask.shape;
  if (s.kind !== "linear" && s.kind !== "mirror") return null;
  const turn = (mask.rotation * Math.PI) / 180;
  return {
    x: mask.x,
    y: mask.y,
    nx: -Math.sin(turn),
    ny: Math.cos(turn),
    half: s.kind === "mirror" ? s.width / 2 : 0,
  };
}

/** A clip's masks in the order they apply. */
export function orderedMasks(clip: Pick<Clip, "masks" | "maskOrder">): ClipMask[] {
  return (clip.maskOrder ?? []).flatMap((id) => {
    const mask = clip.masks?.[id];
    return mask ? [mask] : [];
  });
}

const LENGTHS = new Set(["x", "y", "feather", "expansion"]);
const SHAPE_LENGTHS = new Set(["width", "height"]);
const POINT_LENGTHS = new Set(["x", "y", "inX", "inY", "outX", "outY"]);

/** Whether a key path (`masks.<id>.x`, `masks.<id>.shape.points.<pid>.inX`) holds a length. */
function isLength(path: string): boolean {
  const [head, , ...rest] = path.split(".");
  if (head !== "masks") return false;
  if (rest.length === 1) return LENGTHS.has(rest[0]!);
  if (rest[0] !== "shape") return false;
  if (rest.length === 2) return SHAPE_LENGTHS.has(rest[1]!);
  return rest.length === 4 && rest[1] === "points" && POINT_LENGTHS.has(rest[3]!);
}

/**
 * The clip's masks and keys with every length scaled by `k`: positions, sizes, feather, expansion
 * and path point coordinates and handles, static and keyed. For resizing a composition.
 * shortcut: a whole-shape ("Path") key's value isn't scaled, upgrade when such keys exist.
 */
export function scaleMasks(clip: Clip, k: number): Pick<Clip, "masks" | "animation"> {
  const masks =
    clip.masks &&
    Object.fromEntries(
      Object.entries(clip.masks).map(([id, m]) => {
        const shape = { ...m.shape };
        if ("width" in shape) shape.width *= k;
        if ("height" in shape) shape.height *= k;
        if (shape.kind === "path") {
          shape.points = Object.fromEntries(
            Object.entries(shape.points).map(([pid, p]) => [
              pid,
              {
                x: p.x * k,
                y: p.y * k,
                inX: p.inX * k,
                inY: p.inY * k,
                outX: p.outX * k,
                outY: p.outY * k,
              },
            ]),
          );
        }
        return [
          id,
          {
            ...m,
            x: m.x * k,
            y: m.y * k,
            feather: m.feather * k,
            expansion: m.expansion * k,
            shape,
          },
        ];
      }),
    );
  const animation =
    clip.animation &&
    Object.fromEntries(
      Object.entries(clip.animation).map(([path, track]) => [
        path,
        isLength(path)
          ? {
              ...track,
              keys: track.keys.map((key) =>
                typeof key.value === "number" ? { ...key, value: key.value * k } : key,
              ),
            }
          : track,
      ]),
    );
  return { masks, animation };
}
