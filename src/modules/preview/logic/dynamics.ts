import type { CompressorParams } from "@/modules/project";
import type { DynamicsCurve, DynamicsState } from "../preview.types";

// One dynamics core for the compressor, the gate and ducking: FFmpeg's detector and gain curve
// (libavfilter/af_sidechaincompress.c for `acompressor` and `sidechaincompress`, af_agate.c for
// `agate`), peak detection, channels linked by their average (`link=average`), `level_in` and
// `level_sc` at 1. Each effect is a `DynamicsCurve` worked out once from its settings; the step is
// pure and allocation-free, so it runs per sample in the dynamics worklet. Checked sample for
// sample against ffmpeg n9.0.2: docs/superpowers/specs/2026-11-03-sound-dynamics-check.md.
// Type-only imports: this file is bundled into the worklet, which has no module of the app.

/** A detector at rest, before the first sample. */
export const createDynamicsState = (): DynamicsState => ({ envelope: 0 });

const dbToLinear = (db: number): number => 10 ** (db / 20);

/** FFmpeg's one-pole coefficient for a time in ms. */
const coefficient = (ms: number, sampleRate: number) => Math.min(1, 4000 / (ms * sampleRate));

function curve(
  mode: DynamicsCurve["mode"],
  thresholdDb: number,
  ratio: number,
  knee: number,
  attackMs: number,
  releaseMs: number,
  sampleRate: number,
  rest: Pick<DynamicsCurve, "range" | "makeup" | "mix">,
): DynamicsCurve {
  const threshold = dbToLinear(thresholdDb);
  const root = Math.sqrt(knee);
  const thres = Math.log(threshold);
  const kneeStart = Math.log(threshold / root);
  const kneeStop = Math.log(threshold * root);
  const kneeTarget =
    mode === "compress" ? (kneeStop - thres) / ratio + thres : (kneeStart - thres) * ratio + thres;
  return {
    mode,
    attack: coefficient(attackMs, sampleRate),
    release: coefficient(releaseMs, sampleRate),
    ratio,
    knee,
    thres,
    kneeStart,
    kneeStop,
    linKneeStart: threshold / root,
    linKneeStop: threshold * root,
    kneeTarget,
    ...rest,
  };
}

/** `acompressor` with these settings (`threshold`, `ratio`, `attack`, `release`, `knee`, `makeup`). */
export function compressorCurve(params: CompressorParams, sampleRate: number): DynamicsCurve {
  const { thresholdDb, ratio, kneeDb, attackMs, releaseMs, makeupDb } = params;
  return curve(
    "compress",
    thresholdDb,
    ratio,
    dbToLinear(kneeDb),
    attackMs,
    releaseMs,
    sampleRate,
    {
      range: 0,
      makeup: dbToLinear(makeupDb),
      mix: 1,
    },
  );
}

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

/** The gain a detector level asks for, as FFmpeg's `output_gain` (downward mode). */
function curveGain(envelope: number, c: DynamicsCurve): number {
  const slope = Math.log(envelope);
  if (c.mode === "compress") {
    let gain = (slope - c.thres) / c.ratio + c.thres;
    if (c.knee > 1 && slope < c.kneeStop) {
      gain = hermite(slope, c.kneeStart, c.kneeStop, c.kneeStart, c.kneeTarget, 1, 1 / c.ratio);
    }
    return Math.exp(gain - slope);
  }
  let gain = (slope - c.thres) * c.ratio + c.thres;
  if (c.knee > 1 && slope > c.kneeStart) {
    gain = hermite(slope, c.kneeStart, c.kneeStop, c.kneeTarget, c.kneeStop, c.ratio, 1);
  }
  return Math.max(c.range, Math.exp(gain - slope));
}

/** The detector's input for a stereo frame: the average of both sides' magnitudes (`link=average`). */
export const linkedLevel = (left: number, right: number): number =>
  (Math.abs(left) + Math.abs(right)) / 2;

/**
 * Moves the detector on by one level (`|sample|`, `linkedLevel`, or a key's) and gives the factor
 * every channel of that frame is multiplied by: the curve's gain, makeup and mix.
 */
export function dynamicsGain(state: DynamicsState, c: DynamicsCurve, level: number): number {
  state.envelope += (level - state.envelope) * (level > state.envelope ? c.attack : c.release);
  const envelope = state.envelope;
  const detected = c.mode === "compress" ? envelope > c.linKneeStart : envelope < c.linKneeStop;
  const gain = envelope > 0 && detected ? curveGain(envelope, c) : 1;
  return gain * c.makeup * c.mix + (1 - c.mix);
}

/** One mono sample through a curve, its own key. */
export const dynamicsStep = (state: DynamicsState, c: DynamicsCurve, input: number): number =>
  input * dynamicsGain(state, c, Math.abs(input));
