import type { Biquad } from "../preview.types";

/** The K-weighting of ITU-R BS.1770-4: a high shelf, then the RLB high-pass. */
const SHELF = { f0: 1681.974450955533, gainDb: 3.999843853973347, q: 0.7071752369554196 };
const RLB = { f0: 38.13547087602444, q: 0.5003270373238773 };

/** Stage 1, the head's shelf, derived for any sample rate. */
export function shelfCoefficients(rate: number): Biquad {
  const k = Math.tan((Math.PI * SHELF.f0) / rate);
  const vh = 10 ** (SHELF.gainDb / 20);
  const vb = vh ** 0.4996667741545416;
  const a0 = 1 + k / SHELF.q + k * k;
  return {
    b0: (vh + (vb * k) / SHELF.q + k * k) / a0,
    b1: (2 * (k * k - vh)) / a0,
    b2: (vh - (vb * k) / SHELF.q + k * k) / a0,
    a1: (2 * (k * k - 1)) / a0,
    a2: (1 - k / SHELF.q + k * k) / a0,
  };
}

/** Stage 2, the revised low-frequency B-curve (a 2nd-order high-pass), for any sample rate. */
export function rlbCoefficients(rate: number): Biquad {
  const k = Math.tan((Math.PI * RLB.f0) / rate);
  const a0 = 1 + k / RLB.q + k * k;
  return { b0: 1, b1: -2, b2: 1, a1: (2 * (k * k - 1)) / a0, a2: (1 - k / RLB.q + k * k) / a0 };
}

/** A biquad in transposed direct form II, one channel; its state is two numbers. */
export function createBiquadRun(c: Biquad) {
  let s1 = 0;
  let s2 = 0;
  return {
    next(x: number): number {
      const y = c.b0 * x + s1;
      s1 = c.b1 * x - c.a1 * y + s2;
      s2 = c.b2 * x - c.a2 * y;
      return y;
    },
    reset() {
      s1 = 0;
      s2 = 0;
    },
  };
}
