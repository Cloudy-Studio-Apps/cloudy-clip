/** The graph's frequency range, Hz. */
export const LOW_HZ = 20;
export const HIGH_HZ = 20_000;

/** The analyser's level at the bottom and top of the graph, dB. */
const FLOOR_DB = -90;
const CEILING_DB = -10;

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
  for (let i = 0; i < columns; i++) {
    const first = Math.min(bins.length - 1, Math.floor(hzAt(i / columns) * perHz));
    const last = Math.min(
      bins.length - 1,
      Math.max(first, Math.ceil(hzAt((i + 1) / columns) * perHz)),
    );
    let loudest = -Infinity;
    for (let bin = first; bin <= last; bin++) loudest = Math.max(loudest, bins[bin]!);
    out[i] = Math.min(1, Math.max(0, (loudest - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
  }
}
