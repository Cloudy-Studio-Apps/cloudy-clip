/**
 * Bins of the master's spectrum (`PreviewSound.spectrum`): half the analyser's 2048-sample window.
 * Bin `i` is at `i * rate / (2 * SPECTRUM_BINS)` Hz.
 */
export const SPECTRUM_BINS = 1024;
