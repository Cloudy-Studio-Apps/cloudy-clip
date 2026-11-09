import type { CorrectionValues } from "@/modules/project";
import type { MixerParams, Rgb } from "../../tint.types";
import { LUMA, luma } from "./basics";

// The RGB mixer, after skin pull and before Creative, as the CPU reference (the GLSL is in
// `render/correct.tail.glsl.ts`). Each output channel is its row of the matrix times the input
// (rows out, columns in). Keep brightness scales the whole matrix by `1 / (LUMA · row sums)`, so a
// gray keeps its luma whatever the rows add up to, but only when that sum is at least `KEEP_FLOOR`
// (0.05): below it, or when it is negative, the matrix is used unscaled, so keep brightness never
// blows the picture out (a scale past ×20) or inverts it. Monochrome puts the luma of the mixed
// color in all three channels: with the identity, plain black and white; raise a row to let that
// channel count more.

/** Below this (or negative), `LUMA · row sums` is too small to scale by: keep brightness does nothing. */
export const KEEP_FLOOR = 0.05;

/** The mixer worked out, or null when it changes nothing (the identity, not monochrome). */
export function mixerOf(mixer: CorrectionValues["mixer"]): MixerParams | null {
  const flat = mixer.matrix.flat();
  const identity = flat.every((v, i) => v === (i % 4 === 0 ? 1 : 0));
  if (identity && !mixer.mono) return null;
  const sums = mixer.matrix.map((row) => row[0] + row[1] + row[2]);
  const gray = LUMA[0] * sums[0]! + LUMA[1] * sums[1]! + LUMA[2] * sums[2]!;
  const scale = mixer.keepBrightness && gray >= KEEP_FLOOR ? 1 / gray : 1;
  return { matrix: flat.map((v) => v * scale), mono: mixer.mono };
}

/** A color through the mixer. */
export function applyMixer(rgb: Rgb, mixer: MixerParams): Rgb {
  const m = mixer.matrix;
  const row = (i: number) => m[i]! * rgb[0] + m[i + 1]! * rgb[1] + m[i + 2]! * rgb[2];
  const out: Rgb = [row(0), row(3), row(6)];
  if (!mixer.mono) return out;
  const y = luma(out);
  return [y, y, y];
}
