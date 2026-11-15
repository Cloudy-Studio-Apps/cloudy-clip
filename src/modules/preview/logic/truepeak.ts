/**
 * Taps per phase of the 4x interpolator: the filter FFmpeg's resampler builds by default (so
 * `ebur128`'s true peak, which oversamples with it), a Kaiser-windowed sinc (beta 9) over 32 taps,
 * each phase scaled to sum to 1. The limiter listens with it too (`limiter.ts`).
 */
export const TAPS = 32;
const FACTOR = 4;
const KAISER_BETA = 9;

/** The modified Bessel function of the first kind, order 0, as a series (as the resampler). */
function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  for (let k = 1; k <= 30; k++) {
    const r = x / (2 * k);
    term *= r * r;
    sum += term;
  }
  return sum;
}

/**
 * The three in-between phases, aligned so a tap `k` reads sample `m - k`: they fall between
 * samples `m - TAPS / 2` and `m - TAPS / 2 + 1`. The same numbers as `true_peak_tap` in
 * `src-tauri/src/export/mixeffects.rs`.
 */
export const PHASES = [1, 2, 3].map((phase) => {
  const taps = Array.from({ length: TAPS }, (_, k) => {
    const d = TAPS / 2 - phase / FACTOR - k;
    const w = d / (TAPS / 2);
    const x = Math.PI * d;
    return (Math.sin(x) / x) * besselI0(KAISER_BETA * Math.sqrt(Math.max(1 - w * w, 0)));
  });
  const sum = taps.reduce((total, tap) => total + tap, 0);
  return taps.map((tap) => tap / sum);
});

/**
 * True peak by 4x oversampling: the largest of the samples and the three samples between each
 * pair, as a linear value. It keeps the last `TAPS` samples of one channel.
 */
export function createTruePeak() {
  const history = new Float64Array(TAPS);
  let peak = 0;
  return {
    /** Takes a sample; the interpolated ones are for the sample `TAPS / 2` back. */
    push(x: number): void {
      history.copyWithin(0, 1);
      history[TAPS - 1] = x;
      peak = Math.max(peak, Math.abs(x));
      for (const taps of PHASES) {
        let y = 0;
        for (let i = 0; i < TAPS; i++) y += taps[i]! * history[TAPS - 1 - i]!;
        peak = Math.max(peak, Math.abs(y));
      }
    },
    peak: () => peak,
    reset() {
      history.fill(0);
      peak = 0;
    },
  };
}
