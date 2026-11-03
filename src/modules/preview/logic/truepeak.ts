/** Taps per phase of the 4x interpolator; 4 phases make the 48-tap filter of BS.1770-4 Annex 2. */
const TAPS = 12;
const FACTOR = 4;

/** The three in-between phases of a windowed sinc, aligned so a tap `k` reads sample `m - k`. */
const PHASES = [1, 2, 3].map((phase) =>
  Array.from({ length: TAPS }, (_, i) => {
    const t = FACTOR * (i - TAPS / 2) + phase;
    const window = 0.5 * (1 + Math.cos((Math.PI * t) / (FACTOR * (TAPS / 2))));
    return (Math.sin((Math.PI * t) / FACTOR) / ((Math.PI * t) / FACTOR)) * window;
  }),
);

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
