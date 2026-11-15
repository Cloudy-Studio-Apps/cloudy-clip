import type { InputColorSpace } from "@/modules/project";
import type { CameraSpace, Rgb } from "../../tint.types";
import { toDisplay } from "./basics";

// Camera color spaces to Rec.709, the CPU reference. `render/spaces.glsl.ts` is the same math in
// GLSL and takes every constant below from here. Per pixel:
//
// 1. A camera curve reads the code value the camera wrote, as a share of full scale. A video-range
//    file is decoded to full (`v = (CV - 64) / 876`), so its curve input is `x = (876 v + 64) / 1023`
//    (`codeValue`); a full-range file (ffprobe's `color_range` pc, or a `yuvj` format) or an image
//    already holds `x = v`.
// 2. The curve gives scene-linear light (18% gray at 0.18), each channel on its own.
// 3. A 3 × 3 matrix takes the camera's gamut to Rec.709 primaries. Every gamut here has a D65 white,
//    as Rec.709 does, so no white adaptation (Bradford) is needed. The matrices are
//    `NPM(Rec.709)⁻¹ · NPM(gamut)` from the published primaries (SMPTE RP 177), rounded to 8 places;
//    each row sums to 1, so white stays white.
// 4. The Rec.709 transfer (`toDisplay`, the BT.709 OETF the corrections already use). Only the low
//    end is clamped (at 0, after the transfer: colors outside Rec.709 go negative after the
//    matrix). Light over 1 (log highlights, up to about 38 for S-Log3) is kept, so exposure and
//    rolloff can bring it back; the output clamps at the end of the whole grade, as it always does.
//    On 8-bit fallback targets (no half floats) it clips at the first pass anyway.
//
// sRGB is display light, not scene light: its EOTF, then the inverse of the gamma 2.4 the output is
// shown with (BT.1886), `v' = eotf(v)^(1 / 2.4)`, so a still looks on the Rec.709 output as it did.
//
// Sources (formulas written from these documents, not fetched):
// - Sony, "Technical Summary for S-Gamut3.Cine/S-Log3 and S-Gamut3/S-Log3".
// - Panasonic, "V-Log/V-Gamut Reference Manual".
// - Fujifilm, "F-Log Data Sheet" (Ver. 1.0); F-Gamut is ITU-R BT.2020.
// - Canon, "Canon Log Gamma Curves: Description of the Canon Log, Canon Log 2 and Canon Log 3", and
//   Canon's Cinema Gamut primaries (its IDT documents). Canon's curves give linear over 0.9, so
//   the result is scaled by 0.9 (90% white = 1 before scaling).
// - Apple, "Apple Log Profile White Paper" (2023); its gamut is ITU-R BT.2020.
// - IEC 61966-2-1 (sRGB): sRGB primaries are Rec.709's, so its matrix is the identity.
//
// Check of each curve (encoded the other way, CV = 1023 x), 18% gray and 90% white, against the
// makers' published 10-bit code values. Tolerance: 1 code value (0.1%). "IRE" is (CV - 64) / 876.
//
// | Curve   | 18% gray here      | published          | 90% white here     | published          |
// | ------- | ------------------ | ------------------ | ------------------ | ------------------ |
// | S-Log3  | CV 420.0           | 420                | CV 598.0           | 598                |
// | V-Log   | CV 433.0           | 433                | CV 601.7           | 602                |
// | F-Log   | CV 469.9           | 470                | CV 705.4           | 705                |
// | C-Log2  | CV 407.4, IRE 39.2 | IRE 39.2           | CV 575.2, IRE 58.4 | IRE 58.4           |
// | C-Log3  | CV 351.3, IRE 32.8 | see note           | CV 577.5, IRE 58.6 | see note           |
// | AppleLog| CV 499.5 (0.4883)  | none published     | CV 697.4 (0.6817)  | none published     |
//
// C-Log3 and Apple Log are checked only against their own documents' equations (no gray or white
// code value of theirs could be confirmed offline); the curve constants are the documents'.

/** Rec.709 primaries are where every matrix lands; rows are out r, g, b, columns the camera's. */
export const GAMUTS = {
  /** S-Gamut3.Cine (Sony): R 0.766/0.275, G 0.225/0.800, B 0.089/−0.087, D65. */
  sGamut3Cine: [
    [1.62694741, -0.54013854, -0.08680887],
    [-0.17851553, 1.41794093, -0.2394254],
    [-0.04443612, -0.19591997, 1.24035608],
  ],
  /** ITU-R BT.2020 (Apple Log, F-Gamut): R 0.708/0.292, G 0.170/0.797, B 0.131/0.046, D65. */
  rec2020: [
    [1.660491, -0.58764114, -0.07284986],
    [-0.12455047, 1.1328999, -0.00834942],
    [-0.01815076, -0.1005789, 1.11872966],
  ],
  /** Cinema Gamut (Canon): R 0.74/0.27, G 0.17/1.14, B 0.08/−0.10, D65. */
  cinemaGamut: [
    [1.9238613, -0.79876066, -0.12510063],
    [-0.20431085, 1.49589851, -0.29158766],
    [-0.02368502, -0.42012701, 1.44381203],
  ],
  /** V-Gamut (Panasonic): R 0.730/0.280, G 0.165/0.840, B 0.100/−0.030, D65. */
  vGamut: [
    [1.80657588, -0.69569727, -0.11087861],
    [-0.17009034, 1.30595522, -0.13586487],
    [-0.02520578, -0.15446833, 1.17967411],
  ],
} as const satisfies Record<string, readonly (readonly number[])[]>;

/** S-Log3, in 10-bit code values: the toe ends at `cut`, gray sits at `gray`, black at `black`. */
export const SLOG3 = {
  cut: 171.2102946929,
  gray: 420,
  step: 261.5,
  black: 95,
  toe: 0.01125,
} as const;
/** V-Log: `10^((x - d) / c) - b` from `cut`, `(x - 0.125) / 5.6` below. */
export const VLOG = { cut: 0.181, b: 0.00873, c: 0.241514, d: 0.598206, e: 0.125, f: 5.6 } as const;
/** F-Log: `(10^((x - d) / c) - b) / a` from `cut`, `(x - f) / e` below. */
export const FLOG = {
  cut: 0.100537775223865,
  a: 0.555556,
  b: 0.009468,
  c: 0.344676,
  d: 0.790453,
  e: 8.735631,
  f: 0.092864,
} as const;
/** C-Log2: `(10^((x - cut) / c) - 1) / a` from `cut`, mirrored below it. */
export const CLOG2 = { cut: 0.092864125, c: 0.24136077, a: 87.099375 } as const;
/** C-Log3: mirrored log below `low`, straight to `high`, log above. */
export const CLOG3 = {
  low: 0.097465473,
  high: 0.15277891,
  lowAt: 0.12783901,
  midAt: 0.12512219,
  slope: 1.9754798,
  highAt: 0.12240537,
  c: 0.36726845,
  a: 14.98325,
} as const;
/** Canon's curves give linear over 90% white. */
export const CANON_SCALE = 0.9;
/** Apple Log: `2^((P - δ) / γ) - β` from `cut`, `sqrt(P / c) + r0` from 0, `r0` below. */
export const APPLE_LOG = {
  r0: -0.05641088,
  c: 47.28711236,
  beta: 0.00964052,
  gamma: 0.08550479,
  delta: 0.69336945,
  cut: 47.28711236 * (0.01 + 0.05641088) ** 2,
} as const;
/** sRGB's EOTF: `v / 12.92` up to `cut`, `((v + 0.055) / 1.055)^2.4` above. */
export const SRGB = { cut: 0.04045, slope: 12.92, a: 0.055, power: 2.4 } as const;

/** A full-range value back to the 10-bit code value the camera wrote, over 1023. */
export function codeValue(v: number): number {
  return (876 * v + 64) / 1023;
}

/** The output's display gamma (BT.1886), which sRGB light is encoded back with. */
export const DISPLAY_GAMMA = 2.4;

/** sRGB to the Rec.709 gamma 2.4 output, matching display light. */
export function srgbToDisplay(v: number): number {
  const light = v <= SRGB.cut ? v / SRGB.slope : Math.pow((v + SRGB.a) / (1 + SRGB.a), SRGB.power);
  return Math.pow(light, 1 / DISPLAY_GAMMA);
}

/** Each camera curve: a code value (a share of full scale) to scene-linear light. */
export const CURVES: Record<CameraSpace, (x: number) => number> = {
  slog3(x) {
    const cv = x * 1023;
    return cv >= SLOG3.cut
      ? Math.pow(10, (cv - SLOG3.gray) / SLOG3.step) * 0.19 - 0.01
      : ((cv - SLOG3.black) * SLOG3.toe) / (SLOG3.cut - SLOG3.black);
  },
  vlog(x) {
    return x >= VLOG.cut ? Math.pow(10, (x - VLOG.d) / VLOG.c) - VLOG.b : (x - VLOG.e) / VLOG.f;
  },
  flog(x) {
    return x >= FLOG.cut
      ? (Math.pow(10, (x - FLOG.d) / FLOG.c) - FLOG.b) / FLOG.a
      : (x - FLOG.f) / FLOG.e;
  },
  clog2(x) {
    const l =
      x >= CLOG2.cut
        ? (Math.pow(10, (x - CLOG2.cut) / CLOG2.c) - 1) / CLOG2.a
        : -(Math.pow(10, (CLOG2.cut - x) / CLOG2.c) - 1) / CLOG2.a;
    return l * CANON_SCALE;
  },
  clog3(x) {
    const l =
      x < CLOG3.low
        ? -(Math.pow(10, (CLOG3.lowAt - x) / CLOG3.c) - 1) / CLOG3.a
        : x <= CLOG3.high
          ? (x - CLOG3.midAt) / CLOG3.slope
          : (Math.pow(10, (x - CLOG3.highAt) / CLOG3.c) - 1) / CLOG3.a;
    return l * CANON_SCALE;
  },
  appleLog(x) {
    const { r0, c, beta, gamma, delta, cut } = APPLE_LOG;
    return x >= cut ? Math.pow(2, (x - delta) / gamma) - beta : x >= 0 ? Math.sqrt(x / c) + r0 : r0;
  },
};

/** Each camera space's gamut to Rec.709. */
export const SPACE_GAMUTS: Record<CameraSpace, (typeof GAMUTS)[keyof typeof GAMUTS]> = {
  slog3: GAMUTS.sGamut3Cine,
  vlog: GAMUTS.vGamut,
  flog: GAMUTS.rec2020,
  clog2: GAMUTS.cinemaGamut,
  clog3: GAMUTS.cinemaGamut,
  appleLog: GAMUTS.rec2020,
};

/**
 * A pixel of a source in `space` as display-referred Rec.709. A camera space: its curve (on the
 * code value: `codeValue` when `videoRange`, else the value itself) to linear, its gamut to Rec.709,
 * the Rec.709 transfer, clamped at 0 only (light over 1 is kept for the grade). sRGB:
 * `srgbToDisplay`. Rec.709 is the pixel as it is.
 */
export function toRec709(rgb: Rgb, space: InputColorSpace, videoRange = true): Rgb {
  if (space === "rec709") return rgb;
  if (space === "srgb") return rgb.map(srgbToDisplay) as Rgb;
  const curve = CURVES[space];
  const lin = rgb.map((v) => curve(videoRange ? codeValue(v) : v));
  return SPACE_GAMUTS[space].map((row) =>
    Math.max(toDisplay(row[0] * lin[0]! + row[1] * lin[1]! + row[2] * lin[2]!), 0),
  ) as Rgb;
}
