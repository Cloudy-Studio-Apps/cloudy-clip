import type { CompressorParams } from "@/modules/project";
import { describe, expect, it } from "vitest";
import { compressorCurve, createDynamicsState, dynamicsStep } from "./dynamics";

// Parity with FFmpeg n9.0.2 (docs/superpowers/specs/2026-11-03-sound-dynamics-check.md): `acompressor`. The bar: steady level within 0.5 dB, attack and release within 10 %.
// The signals are FFmpeg's `aevalsrc` at 48 kHz; outputs were written with `-f f32le -ac 1`.

const RATE = 48_000;
const MS = RATE / 1000;
const LOUD = 10 ** (-6 / 20);
const QUIET = 10 ** (-30 / 20);

/** FFmpeg's defaults for attack, release and knee (2.82843 linear), threshold −18 dB, ratio 4. */
const PARAMS: CompressorParams = {
  thresholdDb: -18,
  ratio: 4,
  attackMs: 20,
  releaseMs: 250,
  kneeDb: 20 * Math.log10(2.82843),
  makeupDb: 0,
};

/**
 * RMS level of the last second, in dB:
 * ffmpeg -f lavfi -i "aevalsrc=0.5011872336*sin(2*PI*1000*t):s=48000:d=2" \
 *   -af "acompressor=threshold=-18dB:ratio=4:detection=peak,atrim=start=1,astats" -f null -
 */
const FFMPEG_STEADY_RMS_DB = -17.25402;

/**
 * Time to 90 % of the gain reduction after a step from −30 to −6 dBFS at 1 s, and back to 10 %
 * after the step down at 2 s, read by `stepTimings` from FFmpeg's float output:
 * ffmpeg -f lavfi -i "aevalsrc=if(between(t\,1\,2)\,0.5011872336\,0.0316227766)*sin(2*PI*1000*t):s=48000:d=3" \
 *   -af "acompressor=threshold=-18dB:ratio=4:detection=peak" -c:a pcm_f32le step.wav
 */
const FFMPEG_ATTACK_MS = 19.77;
const FFMPEG_RELEASE_MS = 86.77;

function tone(seconds: number, hz: number, amplitudeAt: (t: number) => number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  return out.map((_, i) => amplitudeAt(i / RATE) * Math.sin((2 * Math.PI * hz * i) / RATE));
}

const step = (t: number, inside: number, outside: number) => (t >= 1 && t <= 2 ? inside : outside);

/** Gain reduction in dB over the 1 ms ending at a sample. */
function reductionAt(output: Float32Array, input: Float32Array, end: number): number {
  let peakIn = 0;
  let peakOut = 0;
  for (let i = end - MS; i < end; i++) {
    peakIn = Math.max(peakIn, Math.abs(input[i] ?? 0));
    peakOut = Math.max(peakOut, Math.abs(output[i] ?? 0));
  }
  return 20 * Math.log10(peakIn / peakOut);
}

/**
 * The reduction settled just before `off`, the time after `on` to reach 90 % of it and the time
 * after `off` to fall to 10 % of it, in ms.
 */
function stepTimings(output: Float32Array, input: Float32Array, on: number, off: number) {
  const settledDb = reductionAt(output, input, off);
  let rise = on + MS;
  while (reductionAt(output, input, rise) < 0.9 * settledDb) rise++;
  let fall = off + MS;
  while (reductionAt(output, input, fall) > 0.1 * settledDb) fall++;
  const ms = (samples: number) => ((samples - MS) * 1000) / RATE;
  return { settledDb, riseMs: ms(rise - on), fallMs: ms(fall - off) };
}

const near = (value: number, expected: number) => Math.abs(value / expected - 1);

describe("compressor (FFmpeg acompressor parity)", () => {
  const compress = (input: Float32Array) => {
    const state = createDynamicsState();
    const curve = compressorCurve(PARAMS, RATE);
    return input.map((x) => dynamicsStep(state, curve, x));
  };

  it("settles a −6 dBFS sine at FFmpeg's level within 0.5 dB", () => {
    const output = compress(tone(2, 1000, () => LOUD)).subarray(RATE);
    const rms = Math.sqrt(output.reduce((sum, x) => sum + x * x, 0) / output.length);
    expect(Math.abs(20 * Math.log10(rms) - FFMPEG_STEADY_RMS_DB)).toBeLessThan(0.5);
  });

  it("attacks and releases within 10 % of FFmpeg's times", () => {
    const input = tone(3, 1000, (t) => step(t, LOUD, QUIET));
    const { riseMs, fallMs } = stepTimings(compress(input), input, RATE, 2 * RATE);
    expect(near(riseMs, FFMPEG_ATTACK_MS)).toBeLessThan(0.1);
    expect(near(fallMs, FFMPEG_RELEASE_MS)).toBeLessThan(0.1);
  });
});
