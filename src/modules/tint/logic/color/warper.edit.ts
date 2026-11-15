import { GRADE_RANGES } from "@/modules/project";
import type { Warper, WarpPlace } from "../../tint.types";
import { warpNode, warpNodes } from "./warper";

// What the Warper's grid does to the values, and where its points sit on screen. The disc is drawn
// with hue 0 (red) to the right, turning clockwise on screen (y down), and strength 1 at `radius`.

/** Offsets smaller than these are no move at all, and the point is dropped from `points`. */
const STILL = { dh: 0.05, ds: 0.0005 };

/** A place on the disc as a point on screen, from the center, y down. */
export function screenOf(place: WarpPlace, radius: number): { x: number; y: number } {
  const angle = place.hue * 2 * Math.PI;
  const r = Math.max(place.strength, 0) * radius;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

/** A point on screen (from the center, y down) as a place on the disc. */
export function placeOf(x: number, y: number, radius: number): WarpPlace {
  const turn = Math.atan2(y, x) / (2 * Math.PI);
  return { hue: turn - Math.floor(turn), strength: Math.hypot(x, y) / radius };
}

/** Where every grid point sits now (the stored ones and those following them), by index. */
export function warpedPlaces(warper: Warper): WarpPlace[] {
  return warpNodes(warper).map((o, index) => {
    const at = warpNode(index);
    return { hue: at.hue + o.dh, strength: Math.max(at.strength + o.ds, 0) };
  });
}

/** The warper with grid point `index` moved to `place` (dropped from `points` when it is home). */
export function movePointTo(warper: Warper, index: number, place: WarpPlace): Warper {
  const home = warpNode(index);
  const turn = place.hue - home.hue;
  const { min: hMin, max: hMax } = GRADE_RANGES["warper.points.dh"]!;
  const { min: sMin, max: sMax } = GRADE_RANGES["warper.points.ds"]!;
  const dh = Math.min(hMax, Math.max(hMin, (turn - Math.round(turn)) * 360));
  const ds = Math.min(sMax, Math.max(sMin, place.strength - home.strength));
  const points = { ...warper.points };
  if (Math.abs(dh) < STILL.dh && Math.abs(ds) < STILL.ds) delete points[index];
  else points[index] = { dh: Math.round(dh * 100) / 100, ds: Math.round(ds * 10000) / 10000 };
  return { ...warper, points };
}

/** The warper with grid point `index` pinned, or unpinned when it was. */
export function togglePin(warper: Warper, index: number): Warper {
  const pinned = warper.pinned.includes(index)
    ? warper.pinned.filter((i) => i !== index)
    : [...warper.pinned, index].sort((a, b) => a - b);
  return { ...warper, pinned };
}
