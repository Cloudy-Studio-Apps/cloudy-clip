import type { FileMatrix, VideoMatrix } from "@/modules/media";
import type { ColorRows, DecoderMatrices, Rgb } from "../preview.types";

/** Kr and Kb of each matrix: Y = Kr·R + (1 − Kr − Kb)·G + Kb·B. */
const LUMA: Record<VideoMatrix, readonly [number, number]> = {
  bt709: [0.2126, 0.0722],
  bt601: [0.299, 0.114],
};

/** RGB to Y, Cb, Cr with `matrix`, all of them normalized (Y 0 to 1, Cb and Cr −0.5 to 0.5). */
export function rgbToYcc(matrix: VideoMatrix): ColorRows {
  const [kr, kb] = LUMA[matrix];
  const kg = 1 - kr - kb;
  return [
    [kr, kg, kb],
    [-kr / (2 * (1 - kb)), -kg / (2 * (1 - kb)), 0.5],
    [0.5, -kg / (2 * (1 - kr)), -kb / (2 * (1 - kr))],
  ];
}

/** Y, Cb, Cr back to RGB with `matrix`: the inverse of `rgbToYcc`. */
export function yccToRgb(matrix: VideoMatrix): ColorRows {
  const [kr, kb] = LUMA[matrix];
  const kg = 1 - kr - kb;
  return [
    [1, 0, 2 * (1 - kr)],
    [1, (-2 * (1 - kb) * kb) / kg, (-2 * (1 - kr) * kr) / kg],
    [1, 2 * (1 - kb), 0],
  ];
}

/** `a` × `b`. */
function multiply(a: ColorRows, b: ColorRows): ColorRows {
  const row = (r: readonly number[]) =>
    [0, 1, 2].map((c) => r[0]! * b[0]![c]! + r[1]! * b[1]![c]! + r[2]! * b[2]![c]!);
  return [row(a[0]), row(a[1]), row(a[2])];
}

/**
 * The 3×3 on RGB that turns a frame decoded with `used` into the frame decoded with `intended`:
 * back to Y, Cb, Cr with `used`, then to RGB with `intended`. Linear, so it works on the 0–255
 * values of a frame once its levels are right.
 */
export function matrixCorrection(used: VideoMatrix, intended: VideoMatrix): ColorRows {
  return multiply(yccToRgb(intended), rgbToYcc(used));
}

/** Made once: a frame asks every draw, and the same rows let a pass be kept. */
const CORRECTIONS: Record<VideoMatrix, ColorRows> = {
  bt601: matrixCorrection("bt601", "bt709"),
  bt709: matrixCorrection("bt709", "bt601"),
};

/**
 * The matrix this webview decodes a file with, from what it did with the HD test clips (`decoder`;
 * one it couldn't tell is taken as right).
 * shortcut: SD is taken as decoded with BT.601, as it's meant, without measuring; add an SD test
 * clip if a webview turns out to decode SD with BT.709.
 */
export function decodedMatrix(file: FileMatrix, decoder: DecoderMatrices): VideoMatrix {
  if (file.intended === "bt601") return "bt601";
  return (file.tagged ? decoder.tagged : decoder.untagged) ?? "bt709";
}

/** The rows that give a frame of `file` its intended matrix; null when it's decoded with it. */
export function frameCorrection(
  file: FileMatrix | null,
  decoder: DecoderMatrices,
): ColorRows | null {
  if (!file) return null;
  const used = decodedMatrix(file, decoder);
  return used === file.intended ? null : CORRECTIONS[used];
}

/**
 * Which matrix drew the matrix clip's 75% yellow (stored BT.709): BT.709 keeps green at red
 * (about 189, 189, 0), BT.601 lifts green about 13 above it (188, 201, 6); a webview squeezing
 * levels keeps the gap near. Null for anything else, such as a frame that wasn't decoded.
 */
export function decodedYellow([r, g, b]: Rgb): VideoMatrix | null {
  if (r < 120 || b > 48) return null;
  const lift = g - r;
  if (Math.abs(lift) <= 5) return "bt709";
  if (lift >= 8 && lift <= 20) return "bt601";
  return null;
}
