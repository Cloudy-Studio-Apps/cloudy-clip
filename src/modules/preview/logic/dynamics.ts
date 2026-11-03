import type { CompressorParams } from "@/modules/project";
import type { DynamicsState } from "../preview.types";

// A port of FFmpeg's `acompressor` (libavfilter/af_sidechaincompress.c), downward mode, peak
// detection, `level_in`, `level_sc` and `mix` at 1. Checked sample for sample against ffmpeg
// n9.0.2: docs/superpowers/specs/2026-11-03-sound-dynamics-check.md. Pure and allocation-free,
// so the same code can run per sample in an AudioWorklet.

/** A detector at rest, before the first sample. */
export const createDynamicsState = (): DynamicsState => ({ envelope: 0 });

const dbToLinear = (db: number): number => 10 ** (db / 20);

/** A cubic Hermite spline from (x0, p0) with slope m0 to (x1, p1) with slope m1. */
function hermite(
  x: number,
  x0: number,
  x1: number,
  p0: number,
  p1: number,
  m0: number,
  m1: number,
) {
  const width = x1 - x0;
  const t = (x - x0) / width;
  const w0 = m0 * width;
  const w1 = m1 * width;
  const t2 = t * t;
  return (2 * p0 + w0 - 2 * p1 + w1) * t2 * t + (-3 * p0 - 2 * w0 + 3 * p1 - w1) * t2 + w0 * t + p0;
}

/**
 * The gain a detector level asks for, as FFmpeg's `output_gain`: levels are natural logs, the
 * ratio applies above the threshold, and a soft knee of `knee` (linear) blends in around it.
 */
function compressorGain(envelope: number, params: CompressorParams): number {
  const threshold = dbToLinear(params.thresholdDb);
  const knee = dbToLinear(params.kneeDb);
  const root = Math.sqrt(knee);
  if (envelope <= 0 || envelope <= threshold / root) return 1;
  const thres = Math.log(threshold);
  const kneeStart = Math.log(threshold / root);
  const kneeStop = Math.log(threshold * root);
  const slope = Math.log(envelope);
  let gain = (slope - thres) / params.ratio + thres;
  if (knee > 1 && slope < kneeStop) {
    const compressedKneeStop = (kneeStop - thres) / params.ratio + thres;
    gain = hermite(slope, kneeStart, kneeStop, kneeStart, compressedKneeStop, 1, 1 / params.ratio);
  }
  return Math.exp(gain - slope);
}

/**
 * Compresses one sample and moves the detector on. The detector follows `|input|` with
 * FFmpeg's one-pole coefficients, `min(1, 4000 / (ms × sampleRate))`, attack while it rises and
 * release while it falls; makeup applies after the gain.
 */
export function compressorStep(
  state: DynamicsState,
  input: number,
  params: CompressorParams,
  sampleRate: number,
): number {
  const level = Math.abs(input);
  const ms = level > state.envelope ? params.attackMs : params.releaseMs;
  state.envelope += (level - state.envelope) * Math.min(1, 4000 / (ms * sampleRate));
  return input * compressorGain(state.envelope, params) * dbToLinear(params.makeupDb);
}
