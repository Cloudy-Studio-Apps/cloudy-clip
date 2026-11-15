/** The graph's frequency range, Hz. */
export const LOW_HZ = 20;
export const HIGH_HZ = 20_000;

/** The analyser's level at the bottom and top of the graph, dB. */
const FLOOR_DB = -100;
const CEILING_DB = -20;

/** Where a frequency falls across the graph, 0 to 1, on a log scale from 20 Hz to 20 kHz. */
export function frequencyX(hz: number): number {
  return Math.log(hz / LOW_HZ) / Math.log(HIGH_HZ / LOW_HZ);
}

/**
 * Fills `out` (one value per column of the graph, left to right) with the height of the spectrum
 * there, 0 to 1: each column takes the loudest bin it covers on the log scale. `bins` is
 * `PreviewSound.spectrum`'s output at sample rate `rate`; a `rate` of 0 (no sound graph) is flat.
 */
export function spectrumHeights(bins: Float32Array, rate: number, out: Float32Array): void {
  const columns = out.length;
  if (rate <= 0 || bins.length === 0) {
    out.fill(0);
    return;
  }
  const perHz = (2 * bins.length) / rate;
  const hzAt = (x: number) => LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, x);
  const at = (position: number) => {
    // A column inside one bin reads between the two bins around it, so the lows aren't blocky.
    const lower = Math.min(bins.length - 1, Math.max(0, Math.floor(position)));
    const upper = Math.min(bins.length - 1, lower + 1);
    const a = bins[lower]!;
    const b = bins[upper]!;
    if (a === -Infinity || b === -Infinity) return Math.max(a, b);
    return a + (b - a) * (position - lower);
  };
  for (let i = 0; i < columns; i++) {
    const first = hzAt(i / columns) * perHz;
    const last = hzAt((i + 1) / columns) * perHz;
    let loudest = at((first + last) / 2);
    // Wider than a bin: the loudest bin it covers.
    for (let bin = Math.ceil(first); bin <= Math.floor(last) && bin < bins.length; bin++) {
      loudest = Math.max(loudest, bins[bin]!);
    }
    out[i] = Math.min(1, Math.max(0, (loudest - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
  }
}
