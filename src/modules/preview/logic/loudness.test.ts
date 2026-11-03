import { describe, expect, it } from "vitest";
import { createLoudnessMeter } from "./loudness";

/** A stereo sine, as the same samples on both sides, at a level in dBFS (EBU Tech 3341). */
function sine(dbfs: number, seconds: number, rate = 48_000, hz = 1000, phase = 0) {
  const amplitude = 10 ** (dbfs / 20);
  const side = new Float32Array(Math.round(seconds * rate));
  side.forEach((_, i) => (side[i] = amplitude * Math.sin(2 * Math.PI * hz * (i / rate) + phase)));
  return [side, side] as const;
}

const silence = (seconds: number, rate = 48_000) => {
  const side = new Float32Array(Math.round(seconds * rate));
  return [side, side] as const;
};

describe("createLoudnessMeter", () => {
  it("reads a −23 dBFS stereo sine as −23 LUFS", () => {
    const meter = createLoudnessMeter(48_000);
    meter.push(...sine(-23, 20));
    const reading = meter.read();
    expect(reading.integrated).toBeCloseTo(-23, 1);
    expect(reading.momentary).toBeCloseTo(-23, 1);
    expect(reading.shortTerm).toBeCloseTo(-23, 1);
  });

  it("reads a −33 dBFS stereo sine as −33 LUFS", () => {
    const meter = createLoudnessMeter(48_000);
    meter.push(...sine(-33, 20));
    expect(meter.read().integrated).toBeCloseTo(-33, 1);
  });

  it("gates silence out of the integrated value", () => {
    const meter = createLoudnessMeter(48_000);
    meter.push(...sine(-23, 10));
    meter.push(...silence(10));
    // The few blocks that straddle the cut count, as they do in Tech 3341's gating cases.
    expect(Math.abs(meter.read().integrated + 23)).toBeLessThan(0.1);
  });

  it("gives the same reading at 44.1 kHz", () => {
    const meter = createLoudnessMeter(44_100);
    meter.push(...sine(-23, 20, 44_100));
    expect(meter.read().integrated).toBeCloseTo(-23, 1);
  });

  it("gives the same reading however the samples are chunked", () => {
    const [left] = sine(-23, 5);
    const whole = createLoudnessMeter(48_000);
    whole.push(left, left);
    const chunked = createLoudnessMeter(48_000);
    for (let at = 0; at < left.length; at += 128) {
      const part = left.subarray(at, at + 128);
      chunked.push(part, part);
    }
    expect(chunked.read()).toEqual(whole.read());
  });

  it("measures a range of 10 LU between −20 and −30 LUFS (Tech 3342)", () => {
    const meter = createLoudnessMeter(48_000);
    meter.push(...sine(-20, 20));
    meter.push(...sine(-30, 20));
    expect(meter.read().range).toBeCloseTo(10, 0);
  });

  it("finds a true peak between the samples (Tech 3341)", () => {
    // Samples of a sine at a quarter of the rate, 45 degrees in, are all ±0.707 of the peak.
    const meter = createLoudnessMeter(48_000);
    meter.push(...sine(0, 1, 48_000, 12_000, Math.PI / 4));
    const { truePeak } = meter.read();
    expect(truePeak).toBeGreaterThan(-0.3);
    expect(truePeak).toBeLessThan(0.3);
  });

  it("starts over on reset", () => {
    const meter = createLoudnessMeter(48_000);
    meter.push(...sine(-23, 10));
    meter.reset();
    expect(meter.read()).toEqual({
      momentary: -Infinity,
      shortTerm: -Infinity,
      integrated: -Infinity,
      range: 0,
      truePeak: -Infinity,
    });
  });
});
