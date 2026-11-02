import type { EqBand } from "@/modules/project";

/** Coefficients of one biquad, the formulas `BiquadFilterNode` uses. */
function coefficients(band: EqBand, sampleRate: number): number[] {
  const w = (2 * Math.PI * band.hz) / sampleRate;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  const A = 10 ** (band.db / 40);
  const q = band.shape === "lowCut" || band.shape === "highCut" ? Math.SQRT1_2 : band.q;
  const alpha = sin / (2 * q);
  const shelf = 2 * Math.sqrt(A) * (sin / Math.SQRT2);
  switch (band.shape) {
    case "bell":
      return [1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A];
    case "lowShelf":
      return [
        A * (A + 1 - (A - 1) * cos + shelf),
        2 * A * (A - 1 - (A + 1) * cos),
        A * (A + 1 - (A - 1) * cos - shelf),
        A + 1 + (A - 1) * cos + shelf,
        -2 * (A - 1 + (A + 1) * cos),
        A + 1 + (A - 1) * cos - shelf,
      ];
    case "highShelf":
      return [
        A * (A + 1 + (A - 1) * cos + shelf),
        -2 * A * (A - 1 + (A + 1) * cos),
        A * (A + 1 + (A - 1) * cos - shelf),
        A + 1 - (A - 1) * cos + shelf,
        2 * (A - 1 - (A + 1) * cos),
        A + 1 - (A - 1) * cos - shelf,
      ];
    case "lowCut":
      return [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
    case "highCut":
      return [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
  }
}

/** How much a biquad changes a frequency, in dB. */
function bandDb(band: EqBand, hz: number, sampleRate: number): number {
  const [b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0] = coefficients(band, sampleRate);
  const w = (2 * Math.PI * hz) / sampleRate;
  const part = (x0: number, x1: number, x2: number) =>
    Math.hypot(
      x0 + x1 * Math.cos(w) + x2 * Math.cos(2 * w),
      x1 * Math.sin(w) + x2 * Math.sin(2 * w),
    );
  return 20 * Math.log10(part(b0, b1, b2) / part(a0, a1, a2));
}

/** What the bands that are on do to a frequency together, in dB. */
export function eqResponse(bands: readonly EqBand[], hz: number, sampleRate: number): number {
  return bands.reduce((total, band) => total + (band.on ? bandDb(band, hz, sampleRate) : 0), 0);
}
