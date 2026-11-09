import type { CorrectionValues } from "@/modules/project";
import type { CorrectionParams, PixelAt, Rgb } from "../../tint.types";
import {
  BAND_REACH,
  CB,
  CHROMA_FULL,
  CR,
  LUMA,
  NO_HUE,
  SKIN_ANGLE,
  SKIN_CHROMA,
  SKIN_FAR,
  SKIN_NEAR,
  bandWeights,
  logish,
  luma,
  rolloff,
  smoothstep,
  toDisplay,
  toLinear,
  unlogish,
  whiteBalance,
} from "./basics";
import { primaryChannel, primaryWheels } from "./wheels";

// One correction, in the spec's order: exposure and white balance, wheels, contrast and pivot,
// highlights / shadows / whites / blacks, rolloff, saturation / vibrance / hue (with protect skin).
// Curves, Color mix, the warper, skin pull, the mixer, Creative and LUTs come in later tasks, at
// their place in that order. `prepareCorrection` works out once what the shader gets as uniforms;
// `applyCorrection` is the per-pixel math, the CPU reference of `render/correct.glsl.ts`.

/** What a correction's values come to for every pixel. */
export function prepareCorrection(values: CorrectionValues): CorrectionParams {
  const wb = whiteBalance(values.temperature, values.tint);
  const exposure = 2 ** values.exposure;
  const hue = (values.hue * Math.PI) / 180;
  return {
    linear: [wb[0] * exposure, wb[1] * exposure, wb[2] * exposure],
    ...primaryWheels(values),
    contrast: values.contrast,
    pivot: logish(values.pivot),
    bands: [
      (values.highlights / 100) * BAND_REACH,
      (values.shadows / 100) * BAND_REACH,
      (values.whites / 100) * BAND_REACH,
      (values.blacks / 100) * BAND_REACH,
    ],
    knee: 1 - values.rolloff / 200,
    saturation: values.saturation,
    vibrance: values.vibrance / 100,
    hue: [Math.cos(hue), Math.sin(hue)],
    skin: values.protectSkin ? 1 : 0,
  };
}

function mapRgb(rgb: Rgb, fn: (x: number, i: 0 | 1 | 2) => number): Rgb {
  return [fn(rgb[0], 0), fn(rgb[1], 1), fn(rgb[2], 2)];
}

/** Saturation, vibrance and hue in Y'CbCr, luma kept, with protect skin. */
function chroma(rgb: Rgb, p: CorrectionParams): Rgb {
  const y = luma(rgb);
  const cb = (rgb[2] - y) / CB;
  const cr = (rgb[0] - y) / CR;
  const length = Math.hypot(cb, cr);
  let skin = 0;
  if (p.skin > 0 && length > NO_HUE) {
    const turn = Math.abs(Math.atan2(cr, cb) - SKIN_ANGLE);
    const away = Math.min(turn, 2 * Math.PI - turn);
    skin = (1 - smoothstep(SKIN_NEAR, SKIN_FAR, away)) * smoothstep(...SKIN_CHROMA, length);
  }
  const c = Math.min(length / CHROMA_FULL, 1);
  const scale = p.saturation * (1 + p.vibrance * (1 - c) * (1 - c));
  const [cos, sin] = p.hue;
  const k = scale + (1 - scale) * skin;
  const turnedCb = cos * cb - sin * cr;
  const turnedCr = sin * cb + cos * cr;
  // Protect skin: the turn and the scale fade out together toward the skin line.
  const outCb = (cb + (turnedCb - cb) * (1 - skin)) * k;
  const outCr = (cr + (turnedCr - cr) * (1 - skin)) * k;
  const r = y + CR * outCr;
  const b = y + CB * outCb;
  return [r, (y - LUMA[0] * r - LUMA[2] * b) / LUMA[1], b];
}

/** One pixel through a correction worked out by `prepareCorrection`. Opacity is the caller's. */
export function applyCorrection(rgb: Rgb, p: CorrectionParams, _at: PixelAt): Rgb {
  let c = mapRgb(rgb, (x, i) => toDisplay(toLinear(x) * p.linear[i]));
  c = mapRgb(c, (x, i) => primaryChannel(x, p.lift[i], p.gammaInv[i], p.gain[i], p.offset[i]));
  c = mapRgb(c, (x) => unlogish(p.pivot + (logish(x) - p.pivot) * p.contrast));
  const w = bandWeights(luma(c));
  const shift = p.bands[0] * w[0] + p.bands[1] * w[1] + p.bands[2] * w[2] + p.bands[3] * w[3];
  c = mapRgb(c, (x) => rolloff(x + shift, p.knee));
  return chroma(c, p);
}

/** One pixel through a correction's values, in the spec's order. `at` is where it is in the picture. */
export function correctPixel(rgb: Rgb, values: CorrectionValues, at: PixelAt): Rgb {
  return applyCorrection(rgb, prepareCorrection(values), at);
}
