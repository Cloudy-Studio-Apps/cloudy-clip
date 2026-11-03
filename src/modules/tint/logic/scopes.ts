/** Rec.709 luma of 8-bit channels, 0..255. */
export function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Histogram of each channel in `bins` buckets, as shares of the busiest bucket (0..1). */
export function histogram(data: Uint8ClampedArray, bins = 64): [number[], number[], number[]] {
  const counts: [number[], number[], number[]] = [
    new Array<number>(bins).fill(0),
    new Array<number>(bins).fill(0),
    new Array<number>(bins).fill(0),
  ];
  let top = 1;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const bin = Math.min(bins - 1, Math.floor((data[i + c]! / 256) * bins));
      const next = (counts[c]![bin] ?? 0) + 1;
      counts[c]![bin] = next;
      if (next > top) top = next;
    }
  }
  return counts.map((row) => row.map((v) => Math.sqrt(v / top))) as [number[], number[], number[]];
}

/** Where a pixel sits on the vectorscope, each axis -1..1 (Cb right, Cr up). */
export function chroma(r: number, g: number, b: number): [number, number] {
  const cb = (-0.1146 * r - 0.3854 * g + 0.5 * b) / 128;
  const cr = (0.5 * r - 0.4542 * g - 0.0458 * b) / 128;
  return [cb, cr];
}
