import type { DeesserEffect } from "@/modules/project";
import type { DeesserSettings, DeesserState } from "../preview.types";

// A port of FFmpeg's `deesser` (libavfilter/af_deesser.c, from Airwindows' DeEss), output mode,
// each channel on its own. Its sense is the second difference of the signal, so it reacts to the
// sharp highs of sibilance; above a one-pole low-pass the sound is divided by a ratio that rises
// with the sense. Two filters take turns, one per sample. Checked against ffmpeg n9.0.2:
// docs/superpowers/specs/2026-11-03-sound-dynamics-check.md. Type-only imports (worklet).

/** FFmpeg's `m` (the most it takes away, 0 to 1): its default, 24 dB. */
export const DEESSER_MAX = 0.5;

/**
 * FFmpeg's `f` (0 to 1) for a frequency: each low-pass filters every other sample with a
 * coefficient of `f²` at 44.1 kHz, so its corner is near `−ln(1 − f²) × 22050 / 2π` Hz.
 */
export const deesserFrequency = (hz: number): number =>
  Math.sqrt(1 - Math.exp((-2 * Math.PI * hz) / 22050));

/** One channel at rest. */
export const createDeesserState = (): DeesserState => ({
  s1: 0,
  s2: 0,
  s3: 0,
  m1: 0,
  m2: 0,
  ratioA: 1,
  ratioB: 1,
  iirSampleA: 0,
  iirSampleB: 0,
  flip: false,
});

/** `deesser=i=<amount>:m=0.5:f=<deesserFrequency(frequencyHz)>` at a sample rate. */
export function deesserSettings(
  { frequencyHz, amount }: Pick<DeesserEffect, "frequencyHz" | "amount">,
  sampleRate: number,
): DeesserSettings {
  const scale = sampleRate < 44100 ? 44100 / sampleRate : sampleRate / 44100;
  return {
    intensity: amount ** 5 * (8192 / scale),
    maxdess: 1 / 10 ** (((DEESSER_MAX - 1) * 48) / 20),
    iirAmount: deesserFrequency(frequencyHz) ** 2 / scale,
  };
}

/** One sample of one channel through the de-esser. */
export function deesserStep(s: DeesserState, c: DeesserSettings, input: number): number {
  s.s3 = s.s2;
  s.s2 = s.s1;
  s.s1 = input;
  s.m1 = (s.s1 - s.s2) * ((s.s1 - s.s2) / 1.3);
  s.m2 = (s.s2 - s.s3) * ((s.s1 - s.s2) / 1.3);
  let sense = (s.m1 - s.m2) * ((s.m1 - s.m2) / 1.3);
  const attackspeed = 7 + sense * 1024;
  sense = Math.min(1 + c.intensity * c.intensity * sense, c.intensity);
  const recovery = 1 + 0.01 / sense;
  const amount = (1 - Math.abs(input)) * c.iirAmount;
  const flip = s.flip;
  s.flip = !flip;
  let iir = flip ? s.iirSampleA : s.iirSampleB;
  let ratio = flip ? s.ratioA : s.ratioB;
  iir = iir * (1 - amount) + input * amount;
  ratio =
    ratio < sense ? (ratio * attackspeed + sense) / (attackspeed + 1) : 1 + (ratio - 1) / recovery;
  ratio = Math.min(ratio, c.maxdess);
  if (flip) {
    s.iirSampleA = iir;
    s.ratioA = ratio;
  } else {
    s.iirSampleB = iir;
    s.ratioB = ratio;
  }
  return iir + (input - iir) / ratio;
}
