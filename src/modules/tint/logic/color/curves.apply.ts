import { DEFAULT_CORRECTION, type CorrectionValues } from "@/modules/project";
import type { MixCurves, Rgb } from "../../tint.types";
import { CB, CHROMA_FULL, CR, HUE_ZERO, LUMA, NO_HUE, luma } from "./basics";
import { monotoneCurve, periodicCurve } from "./curves";

// The curves of a correction, as the CPU reference of the shader's curve step. Each curve is
// sampled into 1024 values (a table of 8 rows, the texture the shader reads), and both sides read
// the table the same way: linear between samples, `x · 1023` being the place in a row.
//
// Choices the spec leaves to the builder:
// - Custom: the Y curve bends each channel, then each channel's own curve: `out = R(Y(in))`.
//   Outside 0…1 a curve goes on at slope 1 from its end (`Y(1) + in - 1` above 1), so values out
//   of range are neither lost nor clamped.
// - Hue curves read the hue in CbCr, red at 0 (`HUE_ZERO`), a full turn being 1, so they agree
//   with the Basics' hue turn. A point at 0.5 changes nothing. Hue vs Hue turns the color by
//   `(v - 0.5)` of a turn (±180°); Hue vs Saturation scales chroma by `2v`; Hue vs Brightness
//   scales luma by `1 + (2v - 1)·c`, `c` the chroma over 0.5 (at most 1), so grays stay; Brightness
//   vs Saturation scales chroma by `2v` at the color's luma (0…1). All read the color as it comes
//   in, and luma is kept by all but Hue vs Brightness.

/** Samples per curve. */
export const CURVE_SAMPLES = 1024;

/** The rows of the curve table, in order. */
export const CURVE_ROWS = ["y", "r", "g", "b", "hueHue", "hueSat", "hueLum", "lumSat"] as const;

/** Where each curve sits in the table. */
export const ROW = { y: 0, r: 1, g: 2, b: 3, hueHue: 4, hueSat: 5, hueLum: 6, lumSat: 7 } as const;

type Curves = CorrectionValues["curves"];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Which steps of the curves change anything: the custom (RGB) curves, the hue and brightness curves. */
export function curvesActive(curves: Curves): { rgb: boolean; hue: boolean } {
  const base = DEFAULT_CORRECTION.curves;
  return {
    rgb: !same(curves.rgb, base.rgb),
    hue: !(
      same(curves.hueHue, base.hueHue) &&
      same(curves.hueSat, base.hueSat) &&
      same(curves.hueLum, base.hueLum) &&
      same(curves.lumSat, base.lumSat)
    ),
  };
}

/**
 * `v` rounded to a half-float, as the GPU's `RGBA16F` texture holds it: a table is exactly what the
 * shader reads, so a steep curve doesn't turn a storage step into a visible one.
 */
export function half(v: number): number {
  if (v < 0) return -half(-v);
  if (v < 2 ** -14) return Math.round(v * 2 ** 24) / 2 ** 24;
  let e = Math.floor(Math.log2(v));
  if (2 ** e > v) e--;
  const step = 2 ** (e - 10);
  return Math.round(v / step) * step;
}

/**
 * The curves sampled: 8 rows (`CURVE_ROWS`) of 1024 values, sample `i` at `x = i / 1023`, each
 * clamped to 0…1 and rounded to a half-float. `mix` (Color mix as hue curves, `logic/color/mix.ts`)
 * is folded into the three hue rows: Hue vs Hue and Hue vs Brightness add its offset from 0.5, Hue vs
 * Saturation multiplies the two scales (`2u · 2m`, so `v = 2um`).
 */
export function sampleCurves(curves: Curves, mix?: MixCurves | null): Float32Array {
  const mixed = mix && {
    hueHue: periodicCurve(mix.hueHue),
    hueSat: periodicCurve(mix.hueSat),
    hueLum: periodicCurve(mix.hueLum),
  };
  const fold = (row: number, x: number, v: number): number => {
    if (!mixed) return v;
    if (row === ROW.hueHue) return v + mixed.hueHue(x) - 0.5;
    if (row === ROW.hueSat) return 2 * v * mixed.hueSat(x);
    if (row === ROW.hueLum) return v + mixed.hueLum(x) - 0.5;
    return v;
  };
  const fns = [
    monotoneCurve(curves.rgb.y),
    monotoneCurve(curves.rgb.r),
    monotoneCurve(curves.rgb.g),
    monotoneCurve(curves.rgb.b),
    periodicCurve(curves.hueHue),
    periodicCurve(curves.hueSat),
    periodicCurve(curves.hueLum),
    monotoneCurve(curves.lumSat),
  ];
  const table = new Float32Array(CURVE_ROWS.length * CURVE_SAMPLES);
  fns.forEach((fn, row) => {
    for (let i = 0; i < CURVE_SAMPLES; i++) {
      const x = i / (CURVE_SAMPLES - 1);
      const v = fold(row, x, fn(x));
      table[row * CURVE_SAMPLES + i] = half(Math.min(1, Math.max(0, v)));
    }
  });
  return table;
}

/** A row of the table at `x` (clamped to 0…1), linear between samples as the texture is read. */
export function curveAt(table: Float32Array, row: number, x: number): number {
  const at = Math.min(1, Math.max(0, x)) * (CURVE_SAMPLES - 1);
  const i = Math.min(Math.floor(at), CURVE_SAMPLES - 2);
  const base = row * CURVE_SAMPLES + i;
  const a = table[base]!;
  return a + (table[base + 1]! - a) * (at - i);
}

/** A custom curve, going on at slope 1 outside 0…1. */
function tone(table: Float32Array, row: number, x: number): number {
  if (x < 0) return curveAt(table, row, 0) + x;
  if (x > 1) return curveAt(table, row, 1) + x - 1;
  return curveAt(table, row, x);
}

/** The hue of a CbCr pair, 0 to 1 from red (`HUE_ZERO`). */
export function cbcrHue(cb: number, cr: number): number {
  const turn = (Math.atan2(cr, cb) - HUE_ZERO) / (2 * Math.PI);
  return turn - Math.floor(turn);
}

/** The hue of a color as the hue curves read it, or null for a gray (no hue). */
export function hueOf(rgb: Rgb): number | null {
  const y = luma(rgb);
  const cb = (rgb[2] - y) / CB;
  const cr = (rgb[0] - y) / CR;
  return Math.hypot(cb, cr) > NO_HUE ? cbcrHue(cb, cr) : null;
}

/** One pixel through the curves: the custom curves when `rgb`, the hue and brightness curves when `hue`. */
export function applyCurves(c: Rgb, table: Float32Array, rgb: boolean, hue: boolean): Rgb {
  let out: Rgb = c;
  if (rgb) {
    out = [
      tone(table, ROW.r, tone(table, ROW.y, out[0])),
      tone(table, ROW.g, tone(table, ROW.y, out[1])),
      tone(table, ROW.b, tone(table, ROW.y, out[2])),
    ];
  }
  if (!hue) return out;
  const y = luma(out);
  let cb = (out[2] - y) / CB;
  let cr = (out[0] - y) / CR;
  const length = Math.hypot(cb, cr);
  let k = 2 * curveAt(table, ROW.lumSat, y);
  let lum = y;
  if (length > NO_HUE) {
    const h = cbcrHue(cb, cr);
    const turn = (curveAt(table, ROW.hueHue, h) - 0.5) * 2 * Math.PI;
    k *= 2 * curveAt(table, ROW.hueSat, h);
    lum = y * (1 + (2 * curveAt(table, ROW.hueLum, h) - 1) * Math.min(length / CHROMA_FULL, 1));
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const turnedCb = cos * cb - sin * cr;
    cr = sin * cb + cos * cr;
    cb = turnedCb;
  }
  const r = lum + CR * cr * k;
  const b = lum + CB * cb * k;
  return [r, (lum - LUMA[0] * r - LUMA[2] * b) / LUMA[1], b];
}
