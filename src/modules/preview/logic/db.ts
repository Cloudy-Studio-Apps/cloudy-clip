/** A linear peak in dB (full scale is 0), `-Infinity` for silence. */
export const peakToDb = (peak: number): number => (peak > 0 ? 20 * Math.log10(peak) : -Infinity);
