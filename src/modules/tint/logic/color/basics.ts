import type { Rgb } from "../../tint.types";

// The Basics of a correction, as the CPU reference. `render/correct.glsl.ts` is the same math in
// GLSL and takes every constant below from here, so the two can't drift. Values are display-referred
// Rec.709 (0 to 1 in range); nothing here clamps, so a value pushed out of range by one step can be
// brought back by a later one, and only what would be undefined (a log of a negative) is guarded.
//
// Choices the spec leaves to the builder:
// - Exposure and white balance work on linear light, through the Rec.709 transfer (BT.709 OETF and
//   its inverse, the linear toe included, extended straight below 0).
// - Temperature moves the white point along the Planckian locus in mireds: 0 is 6500 K, +100 is
//   3200 K (warmer), -100 is about 21 700 K (cooler). The gains are the linear Rec.709 white of that
//   temperature over the white of 6500 K (Kim et al.'s fit of the locus), so 0 is exactly 1.
//   Tint moves green by up to half a stop: + is magenta, - is green. Both are then scaled so the
//   Rec.709 luma of the gains is 1: white balance doesn't change brightness.
// - Contrast works in a log-ish space `lg(x) = ln(1 + K x) / ln(1 + K)` (K = 8), straight below 0
//   with the slope it has at 0; `pivot` is a display value taken into that space, so it stays put.
// - Highlights, shadows, whites and blacks each add up to a quarter of the range, weighted by a
//   smooth band over the luma (smoothsteps; edges in `BANDS`). They move all three channels alike.
// - Rolloff bends values above a knee (1 - rolloff / 200) toward 1 with `k + (1 - k)(1 - e^-t)`,
//   `t = (x - k) / (1 - k)`: slope 1 at the knee, never past 1.
// - Saturation, vibrance and hue work in Y'CbCr with Rec.709 weights, so luma is kept. Hue turns
//   CbCr (+ moves red toward yellow); saturation scales it; vibrance scales it by
//   `1 + vibrance (1 - c)^2`, `c` its length over 0.5, so dull colors move most. Protect skin keeps
//   colors near the skin line (123° in CbCr) as they were, fading out 15° to 35° away from it and
//   for colors under 0.02 to 0.06 of chroma.
// - Skin pull (after saturation) turns the hue of the same colors (that weight) toward the skin line,
//   by up to `SKIN_PULL_REACH` of the way at 100, chroma and luma kept.

/** Rec.709 luma weights. */
export const LUMA: Rgb = [0.2126, 0.7152, 0.0722];
/** Cb and Cr scales of Rec.709: `Cb = (B - Y) / CB`, `Cr = (R - Y) / CR`. */
export const CB = 1.8556;
export const CR = 1.5748;
/** K of the log-ish space contrast works in. */
export const LOG_K = 8;
/** How far each tone band moves a value at ±100. */
export const BAND_REACH = 0.25;
/**
 * Smoothstep edges over luma, `[up from, up to, down from, down to]`: highlights, shadows, whites,
 * blacks. A band is `smoothstep(a, b, y) * (1 - smoothstep(c, d, y))`.
 */
export const BANDS: readonly (readonly [number, number, number, number])[] = [
  [0.35, 0.75, 0.75, 1.0],
  [0.0, 0.25, 0.25, 0.65],
  [0.7, 1.0, 2.0, 3.0],
  [-2.0, -1.0, 0.0, 0.3],
];
/**
 * Angle of pure red in CbCr, in radians: where the hue of the hue curves is 0. Hue runs from there
 * the way the Basics' hue turn does (red toward yellow, green, blue), a full turn being 1.
 */
export const HUE_ZERO = Math.atan2((1 - LUMA[0]) / CR, -LUMA[0] / CB);
/** Chroma (CbCr length) taken as fully saturated by vibrance. */
export const CHROMA_FULL = 0.5;
/** Chroma under which a color has no hue (protect skin skips it). */
export const NO_HUE = 1e-5;
/** Angle of the skin line in CbCr, in radians, and the protected band around it. */
export const SKIN_ANGLE = (123 * Math.PI) / 180;
export const SKIN_NEAR = (15 * Math.PI) / 180;
export const SKIN_FAR = (35 * Math.PI) / 180;
/** Chroma under which nothing is skin, fading in up to the second. */
export const SKIN_CHROMA: readonly [number, number] = [0.02, 0.06];

/** Smoothstep as GLSL has it (`t` clamped). */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Rec.709 luma. */
export function luma(rgb: Rgb): number {
  return LUMA[0] * rgb[0] + LUMA[1] * rgb[1] + LUMA[2] * rgb[2];
}

/** The BT.709 OETF: `4.5 L` below `toe / 4.5`, else `(1 + a) L^power - a`. */
export const REC709 = { toe: 0.081, slope: 4.5, a: 0.099, power: 0.45 } as const;

/** A display value to linear light (inverse BT.709 OETF). */
export function toLinear(v: number): number {
  const { toe, slope, a, power } = REC709;
  return v < toe ? v / slope : Math.pow((v + a) / (1 + a), 1 / power);
}

/** Linear light to a display value (BT.709 OETF). */
export function toDisplay(l: number): number {
  const { toe, slope, a, power } = REC709;
  return l < toe / slope ? slope * l : (1 + a) * Math.pow(l, power) - a;
}

/** `ln(1 + K)`, which scales the log-ish space to 0…1. */
export const LOG_SCALE = Math.log(1 + LOG_K);
/** The log-ish space's slope at 0, which it keeps below 0. */
export const LOG_SLOPE = LOG_K / LOG_SCALE;

/** A display value into the log-ish space of contrast. */
export function logish(x: number): number {
  return x < 0 ? x * LOG_SLOPE : Math.log(1 + LOG_K * x) / LOG_SCALE;
}

/** Back from the log-ish space. */
export function unlogish(y: number): number {
  return y < 0 ? y / LOG_SLOPE : (Math.exp(y * LOG_SCALE) - 1) / LOG_K;
}

// Kim et al. (2002): the CIE 1931 xy of the Planckian locus, 1667 K to 25 000 K.
function planckXy(kelvin: number): [number, number] {
  const t = Math.min(Math.max(kelvin, 1667), 25000);
  const t1 = 1e3 / t;
  const x =
    t <= 4000
      ? -0.2661239 * t1 ** 3 - 0.2343589 * t1 ** 2 + 0.8776956 * t1 + 0.17991
      : -3.0258469 * t1 ** 3 + 2.1070379 * t1 ** 2 + 0.2226347 * t1 + 0.24039;
  const y =
    t <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : t <= 4000
        ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

// The linear Rec.709 color of a white at that temperature (Y = 1).
function planckRgb(kelvin: number): Rgb {
  const [x, y] = planckXy(kelvin);
  const X = x / y;
  const Z = (1 - x - y) / y;
  return [
    3.2404542 * X - 1.5371385 - 0.4985314 * Z,
    -0.969266 * X + 1.8760108 + 0.041556 * Z,
    0.0556434 * X - 0.2040259 + 1.0572252 * Z,
  ];
}

const NEUTRAL_MIRED = 1e6 / 6500;
const WARM_MIRED = 1e6 / 3200;

/** Gains on linear light for `temperature` and `tint` (-100 to 100 each), luma kept. */
export function whiteBalance(temperature: number, tint: number): Rgb {
  if (temperature === 0 && tint === 0) return [1, 1, 1];
  const t = temperature / 100;
  const mired =
    t >= 0 ? NEUTRAL_MIRED + t * (WARM_MIRED - NEUTRAL_MIRED) : NEUTRAL_MIRED * (1 + 0.7 * t);
  const to = planckRgb(1e6 / mired);
  const from = planckRgb(6500);
  const gains: Rgb = [to[0] / from[0], (to[1] / from[1]) * 2 ** (-tint / 200), to[2] / from[2]];
  const y = luma(gains);
  return [gains[0] / y, gains[1] / y, gains[2] / y];
}

/** Each tone band's weight at luma `y`: highlights, shadows, whites, blacks. */
export function bandWeights(y: number): [number, number, number, number] {
  const w = BANDS.map(([a, b, c, d]) => smoothstep(a, b, y) * (1 - smoothstep(c, d, y)));
  return [w[0]!, w[1]!, w[2]!, w[3]!];
}

/** Rolloff of one channel above `knee` (1 is off). */
export function rolloff(x: number, knee: number): number {
  if (knee >= 1 || x <= knee) return x;
  const span = 1 - knee;
  return knee + span * (1 - Math.exp(-(x - knee) / span));
}

/** How much of the way to the skin line skin pull turns a skin hue at 100. */
export const SKIN_PULL_REACH = 0.75;

/** Rec.709 Y'CbCr of a color: `[y, cb, cr]`. */
export function toYcc(rgb: Rgb): Rgb {
  const y = luma(rgb);
  return [y, (rgb[2] - y) / CB, (rgb[0] - y) / CR];
}

/** Back from Y'CbCr. */
export function fromYcc(y: number, cb: number, cr: number): Rgb {
  const r = y + CR * cr;
  const b = y + CB * cb;
  return [r, (y - LUMA[0] * r - LUMA[2] * b) / LUMA[1], b];
}

/**
 * How much a color counts as skin, from its CbCr and their length: 1 on the skin line, fading out
 * `SKIN_NEAR` to `SKIN_FAR` away from it and under `SKIN_CHROMA` of chroma. Protect skin and skin
 * pull both use it.
 */
export function skinWeight(cb: number, cr: number, length: number): number {
  if (length <= NO_HUE) return 0;
  const turn = Math.abs(Math.atan2(cr, cb) - SKIN_ANGLE);
  const away = Math.min(turn, 2 * Math.PI - turn);
  return (1 - smoothstep(SKIN_NEAR, SKIN_FAR, away)) * smoothstep(...SKIN_CHROMA, length);
}

/** Skin pull: a skin hue turned toward the skin line by `pull` (0 to `SKIN_PULL_REACH`) of the way, times its skin weight. */
export function pullSkin(rgb: Rgb, pull: number): Rgb {
  const [y, cb, cr] = toYcc(rgb);
  const length = Math.hypot(cb, cr);
  const w = skinWeight(cb, cr, length);
  if (w <= 0) return rgb;
  let away = Math.atan2(cr, cb) - SKIN_ANGLE;
  if (away < -Math.PI) away += 2 * Math.PI;
  const turn = -away * pull * w;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return fromYcc(y, cos * cb - sin * cr, sin * cb + cos * cr);
}
