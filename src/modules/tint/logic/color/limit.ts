import type { GradeLimit } from "@/modules/project";
import type { LimitParams, Rgb } from "../../tint.types";
import { CB, CHROMA_FULL, CR, NO_HUE, luma, smoothstep } from "./basics";
import { cbcrHue } from "./curves.apply";

// A limit as a key, 0 (the correction leaves the pixel as it was) to 1 (fully corrected), read
// from the correction's input. The corrected picture is mixed over that input by key × opacity.
// - By color: hue, saturation and brightness windows, multiplied. Hue is the hue curves' (CbCr
//   from red, `HUE_ZERO`), stored in degrees; a window `[a, b]` with `a > b` wraps through red.
//   A gray has no hue, so the hue window lets it through and saturation decides. Saturation is
//   chroma over `CHROMA_FULL` and brightness the luma, both clamped to 0…1.
// - By brightness: a window over the luma. Both parts on: their product (what both pick).
// - Each window's edges fall off outward over `soft / 100` of `HUE_SOFT`, `RANGE_SOFT` or
//   `BRIGHT_SOFT` with a smoothstep; softness 0 is a hard edge (inside and on the edge is 1).
// - Refine: softness blurs the key over `refine.soft / 100 × SOFT_REACH` of the picture's height
//   (a spatial blur: the GPU's alone, the per-pixel reference can't have it). Clean up then pulls
//   the key toward 0 and 1, `(k - t) / (1 - 2t)` clamped, `t = clean / 100 × CLEAN_REACH`, so
//   specks and a thin soft rim go. Invert last: `1 - k`.
// - A limit whose color and brightness parts are both missing or off limits nothing: key 1, and
//   the correction draws exactly as without one (refine and invert alone do nothing).

/** The hue edge at softness 100, in turns (30°). */
export const HUE_SOFT = 30 / 360;
/** The saturation and color-brightness edge at softness 100. */
export const RANGE_SOFT = 0.25;
/** The brightness part's edge at softness 100. */
export const BRIGHT_SOFT = 0.25;
/** The key's blur radius at refine softness 100, as a share of the picture's height. */
export const SOFT_REACH = 0.03;
/** Clean up's threshold at 100. */
export const CLEAN_REACH = 0.45;

/** Whether a limit limits anything: its color or brightness part is on. */
export function limitActive(limit: GradeLimit | undefined | null): limit is GradeLimit {
  return limit?.color?.on === true || limit?.brightness?.on === true;
}

/** A hue window in degrees as its middle and half width, in turns. */
export function hueWindow([a, b]: readonly [number, number]): [number, number] {
  const width = b >= a ? b - a : b - a + 360;
  const middle = (a + width / 2) % 360;
  return [middle / 360, width / 720];
}

/** What a limit comes to for every pixel, or null when it limits nothing. */
export function prepareLimit(limit: GradeLimit | undefined | null): LimitParams | null {
  if (!limitActive(limit)) return null;
  const { color, brightness, refine } = limit;
  const colorOn = color?.on === true;
  const edge = (color?.soft ?? 0) / 100;
  return {
    hue: colorOn ? [...hueWindow(color.hue), edge * HUE_SOFT] : null,
    sat: colorOn ? [color.sat[0], color.sat[1], edge * RANGE_SOFT] : [0, 1, 0],
    lum: colorOn ? [color.lum[0], color.lum[1], edge * RANGE_SOFT] : [0, 1, 0],
    bright:
      brightness?.on === true
        ? [brightness.range[0], brightness.range[1], (brightness.soft / 100) * BRIGHT_SOFT]
        : null,
    radius: ((refine?.soft ?? 0) / 100) * SOFT_REACH,
    clean: ((refine?.clean ?? 0) / 100) * CLEAN_REACH,
    invert: limit.invert === true,
  };
}

/** 1 at and above `a`, falling to 0 over `e` below it (a hard step when `e` is 0). */
function rise(x: number, a: number, e: number): number {
  return e > 0 ? smoothstep(a - e, a, x) : x >= a ? 1 : 0;
}

/** 1 at and below `b`, falling to 0 over `e` above it. */
function fall(x: number, b: number, e: number): number {
  return e > 0 ? 1 - smoothstep(b, b + e, x) : x <= b ? 1 : 0;
}

/** How far `x` is inside the window `[from, to, edge]`. */
function inWindow(x: number, [a, b, e]: readonly [number, number, number]): number {
  return rise(x, a, e) * fall(x, b, e);
}

/** The key before refine (no blur, no clean up, not inverted): what the key pass writes. */
export function rawKey(rgb: Rgb, p: LimitParams): number {
  const y = luma(rgb);
  const lum = Math.min(Math.max(y, 0), 1);
  let k = 1;
  if (p.hue) {
    const cb = (rgb[2] - y) / CB;
    const cr = (rgb[0] - y) / CR;
    const len = Math.hypot(cb, cr);
    if (len > NO_HUE) {
      let d = cbcrHue(cb, cr) - p.hue[0];
      d -= Math.floor(d + 0.5);
      k *= fall(Math.abs(d), p.hue[1], p.hue[2]);
    }
    k *= inWindow(Math.min(len / CHROMA_FULL, 1), p.sat);
    k *= inWindow(lum, p.lum);
  }
  if (p.bright) k *= inWindow(lum, p.bright);
  return k;
}

/** Clean up and invert, after the blur. */
export function finishKey(k: number, p: LimitParams): number {
  const t = p.clean;
  const cleaned = t > 0 ? Math.min(Math.max((k - t) / (1 - 2 * t), 0), 1) : k;
  return p.invert ? 1 - cleaned : cleaned;
}

/**
 * How much of a correction reaches a pixel of its input, 0 to 1: 1 without a limit. The refine
 * blur is left out (a spatial blur; see the top of this file).
 */
export function keyOf(rgb: Rgb, limit: GradeLimit | undefined | null): number {
  const p = prepareLimit(limit);
  return p ? finishKey(rawKey(rgb, p), p) : 1;
}
