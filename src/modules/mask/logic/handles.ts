import { MASK_RANGES, type ClipMask, type MaskMapping, type Vec2 } from "@/modules/project";
import type { MaskHandle, MaskPatch } from "../mask.types";
import { frameLength, placeLocal, toLocal } from "./mapping";

/** How far outside the shape the rotate and feather handles sit, and the roundness dot's inset, in output px. */
const ROTATE_GAP = 28;
const FEATHER_GAP = 20;
const ROUND_INSET = 12;

const clamp = (v: number, field: string) =>
  Math.min(MASK_RANGES[field]!.max, Math.max(MASK_RANGES[field]!.min, v));

/** Drags the whole mask (inside a shape, or a line's center): its `x`/`y`. */
export const MOVE_HANDLE: MaskHandle = {
  id: "move",
  kind: "move",
  dx: 0,
  dy: 0,
  at: { x: 0, y: 0 },
};

/** The star's first inner corner's direction (the one `maskOutline` draws second). */
function innerTurn(points: number): number {
  return -Math.PI / 2 + Math.PI / Math.round(points);
}

/** The handles of a preset mask (none for a path), in mask space, from its values now. */
export function presetHandles(mask: ClipMask, m: MaskMapping): MaskHandle[] {
  const s = mask.shape;
  if (s.kind === "path") return [];
  // Gaps are in output px: as many mask px as cover them along the mask's own axes.
  const gapY = (px: number) => px / frameLength(m, mask, { x: 0, y: 1 });
  const gapX = (px: number) => px / frameLength(m, mask, { x: 1, y: 0 });
  const handle = (id: string, kind: MaskHandle["kind"], dx: number, dy: number, at: Vec2) => ({
    id,
    kind,
    dx,
    dy,
    at: placeLocal(mask, at),
  });
  if (s.kind === "linear" || s.kind === "mirror") {
    const half = s.kind === "mirror" ? s.width / 2 : 0;
    const list = [
      handle("move", "move", 0, 0, { x: 0, y: 0 }),
      handle("rotate", "rotate", 0, -1, { x: 0, y: -half - gapY(ROTATE_GAP) }),
      handle("feather", "feather", 0, 1, { x: 0, y: half + gapY(FEATHER_GAP) + mask.feather }),
    ];
    if (s.kind === "mirror") {
      list.push(handle("width:-1", "width", 0, -1, { x: 0, y: -half }));
      list.push(handle("width:1", "width", 0, 1, { x: 0, y: half }));
    }
    return list;
  }
  const hw = s.width / 2;
  const hh = s.height / 2;
  const list: MaskHandle[] = [];
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1]) {
      if (dx === 0 && dy === 0) continue;
      const kind = dx !== 0 && dy !== 0 ? "corner" : "side";
      list.push(handle(`${dx}:${dy}`, kind, dx, dy, { x: dx * hw, y: dy * hh }));
    }
  }
  list.push(handle("rotate", "rotate", 0, -1, { x: 0, y: -hh - gapY(ROTATE_GAP) }));
  list.push(handle("feather", "feather", 0, 1, { x: 0, y: hh + gapY(FEATHER_GAP) + mask.feather }));
  if (s.kind === "rectangle") {
    const r = (s.roundness * Math.min(s.width, s.height)) / 2;
    const at = { x: hw - r - gapX(ROUND_INSET), y: -hh + r + gapY(ROUND_INSET) };
    list.push(handle("roundness", "roundness", 1, -1, at));
  }
  if (s.kind === "star") {
    const a = innerTurn(s.points);
    const at = { x: hw * s.inner * Math.cos(a), y: hh * s.inner * Math.sin(a) };
    list.push(handle("inner", "inner", 0, 0, at));
  }
  return list;
}

/** A corner or side drag: the opposite side stays (Alt: the center), Shift keeps a corner's proportions. */
function resize(
  mask: ClipMask,
  w: number,
  h: number,
  { dx, dy }: MaskHandle,
  du: Vec2,
  shift: boolean,
  alt: boolean,
): MaskPatch {
  const ax = alt ? 0 : (-dx * w) / 2;
  const ay = alt ? 0 : (-dy * h) / 2;
  let cx = (dx * w) / 2 + du.x;
  let cy = (dy * h) / 2 + du.y;
  if (shift && dx !== 0 && dy !== 0) {
    const vx = (dx * w) / 2 - ax;
    const vy = (dy * h) / 2 - ay;
    const k = ((cx - ax) * vx + (cy - ay) * vy) / (vx * vx + vy * vy);
    cx = ax + k * vx;
    cy = ay + k * vy;
  }
  const span = alt ? 2 : 1;
  const width = dx !== 0 ? clamp(Math.abs(cx - ax) * span, "width") : w;
  const height = dy !== 0 ? clamp(Math.abs(cy - ay) * span, "height") : h;
  const center = alt
    ? { x: 0, y: 0 }
    : { x: dx !== 0 ? (cx + ax) / 2 : 0, y: dy !== 0 ? (cy + ay) / 2 : 0 };
  const at = placeLocal(mask, center);
  return { x: at.x, y: at.y, shape: { width, height } };
}

/**
 * What dragging `handle` of `mask` (its values when the drag began) from `from` to `to` (both in
 * mask space) changes: only the fields the handle moves.
 */
export function dragPatch(
  mask: ClipMask,
  handle: MaskHandle,
  from: Vec2,
  to: Vec2,
  { shift, alt }: { shift: boolean; alt: boolean },
): MaskPatch {
  if (handle.kind === "move") return { x: mask.x + to.x - from.x, y: mask.y + to.y - from.y };
  if (handle.kind === "rotate") {
    const a0 = Math.atan2(from.y - mask.y, from.x - mask.x);
    const a1 = Math.atan2(to.y - mask.y, to.x - mask.x);
    let turn = ((a1 - a0) * 180) / Math.PI;
    if (turn > 180) turn -= 360;
    if (turn <= -180) turn += 360;
    const rotation = mask.rotation + turn;
    return { rotation: shift ? Math.round(rotation / 15) * 15 : rotation };
  }
  const u0 = toLocal(mask, from);
  const u1 = toLocal(mask, to);
  const du = { x: u1.x - u0.x, y: u1.y - u0.y };
  const s = mask.shape;
  if (handle.kind === "feather") return { feather: clamp(mask.feather + du.y, "feather") };
  if (handle.kind === "width" && s.kind === "mirror") {
    return { shape: { width: clamp(2 * Math.abs((handle.dy * s.width) / 2 + du.y), "width") } };
  }
  if (!("height" in s)) return {};
  if (handle.kind === "roundness" && s.kind === "rectangle") {
    const half = Math.min(s.width, s.height) / 2;
    const r = s.roundness * half + (du.y - du.x) / 2;
    return { shape: { roundness: clamp(r / half, "roundness") } };
  }
  if (handle.kind === "inner" && s.kind === "star") {
    const a = innerTurn(s.points);
    const hw = s.width / 2;
    const hh = s.height / 2;
    const px = hw * s.inner * Math.cos(a) + du.x;
    const py = hh * s.inner * Math.sin(a) + du.y;
    return { shape: { inner: clamp((px / hw) * Math.cos(a) + (py / hh) * Math.sin(a), "inner") } };
  }
  if (handle.kind === "corner" || handle.kind === "side") {
    return resize(mask, s.width, s.height, handle, du, shift, alt);
  }
  return {};
}

/** The mask with a canvas patch over it (shape numbers into the shape), to draw it mid-drag. */
export function withPatch(mask: ClipMask, patch: MaskPatch): ClipMask {
  return { ...mask, ...patch, shape: { ...mask.shape, ...patch.shape } } as ClipMask;
}
