import type { CorrectionValues } from "@/modules/project";
import type { PixelAt, Rgb, SplitParams, VignetteParams } from "../../tint.types";
import { luma, smoothstep } from "./basics";
import { wheelChannels } from "./wheels";

// Creative, the last step of a correction before its LUT, as the CPU reference
// (`render/correct.tail.glsl.ts` is the GLSL). In this order:
// - Split toning: each tint is a puck on a wheel (as the primary wheels: red at the top, clockwise,
//   y down) whose channel numbers (`wheelChannels`, `SPLIT_REACH` at the edge) are added, the
//   shadow tint weighted by `1 - h` and the highlight tint by `h = smoothstep(p - SPLIT_SPAN,
//   p + SPLIT_SPAN, luma)`, with `p = 0.5 - balance / 200` (+ gives the highlight tint more).
// - Faded film (`f = fade / 100`): chroma times `1 - FADE_MUTE f` (luma kept), then each channel
//   lifted by `FADE_LIFT f (1 - clamp(c, 0, 1))^2`, so blacks go milky and whites stay.
// - Vignette, in the picture's own coordinates (`PixelAt`: u, v over the clip's picture, so it
//   follows the clip however it is placed). From the middle, `q = 2 (u - 0.5, v - 0.5)` scaled by
//   `s`, and the distance `d = (|qx|^n + |qy|^n)^(1/n)`: roundness 0 is an ellipse fitting the
//   picture (`s` 1, `n` 2); toward +100 `s` goes to a circle fitting its short side; toward -100
//   `n` grows to `2 + VIGNETTE_SQUARE`, a rounded rectangle. The weight is
//   `smoothstep(center - width / 2, center + width / 2, d)` with `center = 0.4 + 0.8 midpoint/100`
//   and `width = 0.05 + feather / 100`. Amount below 0 darkens, `c (1 + a w)`; above 0 lightens
//   toward white, `c + (1 - c) a w`.

/** How far a split-toning tint moves a channel at the edge of its wheel. */
export const SPLIT_REACH = 0.15;
/** Half the luma span over which split toning goes from the shadow tint to the highlight tint. */
export const SPLIT_SPAN = 0.4;
/** How much faded film lifts black at 100. */
export const FADE_LIFT = 0.18;
/** How much of the chroma faded film takes away at 100. */
export const FADE_MUTE = 0.25;
/** How much the vignette's exponent grows at roundness -100. */
export const VIGNETTE_SQUARE = 6;

/** Split toning worked out, or null when both tints sit in the middle. */
export function splitTone(creative: CorrectionValues["creative"]): SplitParams | null {
  const { shadowTint, highlightTint, balance } = creative;
  if (shadowTint.x === 0 && shadowTint.y === 0 && highlightTint.x === 0 && highlightTint.y === 0) {
    return null;
  }
  const reach = { m: 0, color: SPLIT_REACH };
  return {
    shadow: wheelChannels({ ...shadowTint, m: 0 }, reach),
    highlight: wheelChannels({ ...highlightTint, m: 0 }, reach),
    pivot: 0.5 - balance / 200,
  };
}

/** The vignette worked out, or null when its amount is 0. */
export function vignetteOf(creative: CorrectionValues["creative"]): VignetteParams | null {
  const { amount, midpoint, roundness, feather } = creative.vignette;
  if (amount === 0) return null;
  return {
    amount: amount / 100,
    center: 0.4 + 0.8 * (midpoint / 100),
    width: 0.05 + feather / 100,
    round: roundness / 100,
  };
}

/** Split toning and faded film on a color. */
export function applyTone(rgb: Rgb, split: SplitParams | null, fade: number): Rgb {
  let c = rgb;
  if (split) {
    const h = smoothstep(split.pivot - SPLIT_SPAN, split.pivot + SPLIT_SPAN, luma(c));
    c = [
      c[0] + (1 - h) * split.shadow[0] + h * split.highlight[0],
      c[1] + (1 - h) * split.shadow[1] + h * split.highlight[1],
      c[2] + (1 - h) * split.shadow[2] + h * split.highlight[2],
    ];
  }
  if (fade > 0) {
    const y = luma(c);
    const keep = 1 - FADE_MUTE * fade;
    const lift = (x: number) => {
      const v = y + (x - y) * keep;
      const dark = 1 - Math.min(Math.max(v, 0), 1);
      return v + FADE_LIFT * fade * dark * dark;
    };
    c = [lift(c[0]), lift(c[1]), lift(c[2])];
  }
  return c;
}

/** How much of the vignette a pixel gets, 0 in the middle to 1 at the edges. */
export function vignetteWeight(at: PixelAt, v: VignetteParams): number {
  const round = Math.max(v.round, 0);
  const fit = Math.min(at.aspect, 1);
  const sx = 1 + (at.aspect / fit - 1) * round;
  const sy = 1 + (1 / fit - 1) * round;
  const n = 2 + Math.max(-v.round, 0) * VIGNETTE_SQUARE;
  const qx = Math.abs((at.u - 0.5) * 2 * sx);
  const qy = Math.abs((at.v - 0.5) * 2 * sy);
  const d = Math.pow(Math.pow(qx, n) + Math.pow(qy, n), 1 / n);
  return smoothstep(v.center - v.width / 2, v.center + v.width / 2, d);
}

/** The vignette on a color at weight `w`: darker toward black, or lighter toward white. */
export function applyVignette(rgb: Rgb, amount: number, w: number): Rgb {
  const a = amount * w;
  if (amount < 0) return [rgb[0] * (1 + a), rgb[1] * (1 + a), rgb[2] * (1 + a)];
  return [rgb[0] + (1 - rgb[0]) * a, rgb[1] + (1 - rgb[1]) * a, rgb[2] + (1 - rgb[2]) * a];
}
