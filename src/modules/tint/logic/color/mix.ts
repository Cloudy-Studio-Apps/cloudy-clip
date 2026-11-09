import { MIX_FAMILIES, type CorrectionValues, type MixFamilyName } from "@/modules/project";
import type { CurvePoint, MixCurves, Rgb } from "../../tint.types";
import { curvesActive, hueOf, sampleCurves } from "./curves.apply";

// Color mix, as hue curves. It has no step of its own: its families become points on Hue vs Hue,
// Hue vs Saturation and Hue vs Brightness, folded into the correction's own hue curves when they
// are sampled (`sampleCurves`), so one curve texture carries both and the shader has one path.
//
// Choices the spec leaves to the builder:
// - Each family sits at the hue (as the hue curves read it, `hueOf`) of a full color of HSV hue
//   0°, 30°, 60°, 120°, 180°, 225°, 270° and 315°: reds 0, oranges 0.099, yellows 0.2, greens 0.352,
//   aquas 0.5, blues 0.654, purples 0.783, magentas 0.883.
// - Hue ±100 turns the family's hue by ±30° (y = 0.5 ± 1/12 on Hue vs Hue). Saturation ±100 scales
//   its chroma from 0 to 2 (y = 0.5 + sat / 200). Brightness ±100 scales the luma of its saturated
//   colors by 0.5 to 1.5 (y = 0.5 + lum / 400 on Hue vs Brightness).
// - Range (0…100) is how far a family reaches. Between two families sits a point at the middle hue:
//   at range 0 it is neutral, so a family fades out half way to its neighbour; at 100 it is the
//   mean of the two, so a family's change carries on to its neighbour's center.

/** Hue of each family's full color (HSV degrees), which also colors its dot. */
export const FAMILY_DEGREES: Record<MixFamilyName, number> = {
  reds: 0,
  oranges: 30,
  yellows: 60,
  greens: 120,
  aquas: 180,
  blues: 225,
  purples: 270,
  magentas: 315,
};

/** The full color (value and saturation 1) of an HSV hue in degrees. */
function hsv(degrees: number): Rgb {
  const at = (n: number) => {
    const k = (n + degrees / 60) % 6;
    return 1 - Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [at(5), at(3), at(1)];
}

/** Where each family sits on the hue curves (0…1 from red), in `MIX_FAMILIES` order. */
export const FAMILY_HUES: readonly number[] = MIX_FAMILIES.map(
  (name) => hueOf(hsv(FAMILY_DEGREES[name])) ?? 0,
);

/** How far Hue ±100 turns a family, in turns. */
const HUE_REACH = 1 / 12;

type Mix = CorrectionValues["mix"];

/** Whether Color mix changes anything. */
export function mixActive(mix: Mix): boolean {
  return MIX_FAMILIES.some((name) => {
    const f = mix[name];
    return f.hue !== 0 || f.sat !== 0 || f.lum !== 0;
  });
}

/** The family whose hue is nearest `hue` (0…1), as an index into `MIX_FAMILIES`. */
export function nearestFamily(hue: number): number {
  let best = 0;
  let far = Infinity;
  FAMILY_HUES.forEach((at, i) => {
    const d = Math.abs(hue - at) % 1;
    const away = Math.min(d, 1 - d);
    if (away < far) {
      far = away;
      best = i;
    }
  });
  return best;
}

/**
 * Color mix as three hue curves: a point at each family's hue, and one at the middle hue between
 * each two, neutral at range 0 and the mean of the two at 100. Read with `periodicCurve`.
 */
export function mixToHueCurves(mix: Mix): MixCurves {
  const spread = mix.range / 100;
  const ys = {
    hueHue: MIX_FAMILIES.map((name) => 0.5 + (mix[name].hue / 100) * HUE_REACH),
    hueSat: MIX_FAMILIES.map((name) => 0.5 + mix[name].sat / 200),
    hueLum: MIX_FAMILIES.map((name) => 0.5 + mix[name].lum / 400),
  };
  const curve = (y: readonly number[]): CurvePoint[] => {
    const points: CurvePoint[] = [];
    FAMILY_HUES.forEach((x, i) => {
      const next = (i + 1) % FAMILY_HUES.length;
      const end = next === 0 ? 1 : FAMILY_HUES[next]!;
      const mean = (y[i]! + y[next]!) / 2;
      points.push([x, y[i]!], [(x + end) / 2, 0.5 + spread * (mean - 0.5)]);
    });
    return points;
  };
  return { hueHue: curve(ys.hueHue), hueSat: curve(ys.hueSat), hueLum: curve(ys.hueLum) };
}

/** What the curve step of a correction has to do: the custom curves, and the hue curves or Color mix. */
export function curveStepActive(values: CorrectionValues): { rgb: boolean; hue: boolean } {
  const curves = curvesActive(values.curves);
  return { rgb: curves.rgb, hue: curves.hue || mixActive(values.mix) };
}

/** The curve table of a correction: its curves, with Color mix folded into the hue rows. */
export function sampleCurveStep(values: CorrectionValues): Float32Array {
  return sampleCurves(values.curves, mixActive(values.mix) ? mixToHueCurves(values.mix) : null);
}

/** The mix with one family's field set. */
export function withFamily(
  mix: Mix,
  name: MixFamilyName,
  field: "hue" | "sat" | "lum",
  value: number,
): Mix {
  return { ...mix, [name]: { ...mix[name], [field]: value } };
}
