import type { LoudnessMeter, LoudnessReading } from "../preview.types";
import { peakToDb } from "./db";
import { createHistogram, toLoudness } from "./gating";
import { createBiquadRun, rlbCoefficients, shelfCoefficients } from "./kweight";
import { createTruePeak } from "./truepeak";

/** What a meter reads before any sound: nothing measured, no range. */
export const NO_LOUDNESS: LoudnessReading = {
  momentary: -Infinity,
  shortTerm: -Infinity,
  integrated: -Infinity,
  range: 0,
  truePeak: -Infinity,
};

/** A 400 ms block steps by 100 ms (75 % overlap), so energy is kept per 100 ms. */
const STEP_SECONDS = 0.1;
const MOMENTARY_STEPS = 4;
const SHORT_TERM_STEPS = 30;
/** BS.1770-4's relative gate for the integrated value, and EBU Tech 3342's for the range. */
const INTEGRATED_GATE = -10;
const RANGE_GATE = -20;

const mean = (values: number[], count: number): number => {
  let sum = 0;
  for (let i = values.length - count; i < values.length; i++) sum += values[i]!;
  return sum / count;
};

/**
 * A BS.1770-4 loudness meter for a stereo signal: K-weighting derived for `sampleRate`, 400 ms
 * momentary and 3 s short-term windows, integrated with the absolute (−70 LUFS) and relative
 * (−10 LU) gates, range per EBU Tech 3342 (10th to 95th percentile above a −20 LU gate), and true
 * peak by 4x oversampling. Pure: it takes any chunk size and keeps no more than a few seconds of
 * samples and a histogram.
 */
export function createLoudnessMeter(sampleRate: number): LoudnessMeter {
  const stepLength = Math.round(sampleRate * STEP_SECONDS);
  const shelf = shelfCoefficients(sampleRate);
  const rlb = rlbCoefficients(sampleRate);
  const shelfLeft = createBiquadRun(shelf);
  const rlbLeft = createBiquadRun(rlb);
  const shelfRight = createBiquadRun(shelf);
  const rlbRight = createBiquadRun(rlb);
  const peakLeft = createTruePeak();
  const peakRight = createTruePeak();
  const integrated = createHistogram();
  const shortTerms = createHistogram();
  /** Mean-square energy (both sides summed) of each 100 ms step, newest last. */
  const steps: number[] = [];
  let energy = 0;
  let filled = 0;

  const endStep = () => {
    steps.push(energy / filled);
    if (steps.length > SHORT_TERM_STEPS) steps.shift();
    energy = 0;
    filled = 0;
    if (steps.length >= MOMENTARY_STEPS) integrated.add(mean(steps, MOMENTARY_STEPS));
    if (steps.length >= SHORT_TERM_STEPS) shortTerms.add(mean(steps, SHORT_TERM_STEPS));
  };

  return {
    push(left, right) {
      // Plain loops and no per-sample objects: this runs on the audio thread.
      for (let i = 0; i < left.length; i++) {
        const l = left[i]!;
        const r = right[i]!;
        peakLeft.push(l);
        peakRight.push(r);
        const wl = rlbLeft.next(shelfLeft.next(l));
        const wr = rlbRight.next(shelfRight.next(r));
        energy += wl * wl + wr * wr;
        if (++filled === stepLength) endStep();
      }
    },
    read() {
      const [low, high] = shortTerms.percentiles([0.1, 0.95], RANGE_GATE);
      return {
        momentary:
          steps.length >= MOMENTARY_STEPS ? toLoudness(mean(steps, MOMENTARY_STEPS)) : -Infinity,
        shortTerm:
          steps.length >= SHORT_TERM_STEPS ? toLoudness(mean(steps, SHORT_TERM_STEPS)) : -Infinity,
        integrated: toLoudness(integrated.gatedEnergy(INTEGRATED_GATE)),
        range: Number.isFinite(low) && Number.isFinite(high) ? Math.max(0, high! - low!) : 0,
        truePeak: peakToDb(Math.max(peakLeft.peak(), peakRight.peak())),
      };
    },
    reset() {
      for (const run of [shelfLeft, rlbLeft, shelfRight, rlbRight]) run.reset();
      peakLeft.reset();
      peakRight.reset();
      integrated.reset();
      shortTerms.reset();
      steps.length = 0;
      energy = 0;
      filled = 0;
    },
  };
}
