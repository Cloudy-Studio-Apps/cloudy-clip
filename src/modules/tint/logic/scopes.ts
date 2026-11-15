import type { ChannelStats, ScopeBinning, ScopeStats } from "../tint.types";

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

/** Columns per channel in the parade grid, and in the waveform grid (which has one channel). */
export const PARADE_COLUMNS = 128;
export const WAVE_COLUMNS = 256;
/** Rows (levels) of the parade and waveform grids, and the side of the vectorscope grid. */
export const LEVELS = 128;
export const VECTOR_SIDE = 128;
/**
 * Grid shapes by kind: parade is 3 × PARADE_COLUMNS wide and LEVELS tall (row 0 is white); wave
 * is WAVE_COLUMNS wide and LEVELS tall; vector is VECTOR_SIDE square (Cb right, Cr up, each
 * -1..1); hist is 3 × HIST_BINS values (bins per channel here).
 */
export const HIST_BINS = 64;

/**
 * Bins a frame for a scope. Grids are row-major, `0..1` brightness: how crowded each cell is for
 * a frame this size (a lone pixel stays faint, a crowd saturates). The histogram is
 * `[red…, green…, blue…]` as `histogram()` gives it.
 */
export function scopeData(frame: ImageData, kind: ScopeBinning): Float32Array {
  const { data, width, height } = frame;
  if (kind === "hist") {
    return Float32Array.from(histogram(data, HIST_BINS).flat());
  }
  const columns = kind === "parade" ? PARADE_COLUMNS * 3 : kind === "wave" ? WAVE_COLUMNS : 0;
  const cols = kind === "vector" ? VECTOR_SIDE : columns;
  const rows = kind === "vector" ? VECTOR_SIDE : LEVELS;
  const grid = new Float32Array(cols * rows);
  const perColumn = Math.max(1, height);
  const channelCols = kind === "parade" ? PARADE_COLUMNS : WAVE_COLUMNS;
  const level = (v: number) => Math.min(LEVELS - 1, LEVELS - 1 - Math.floor((v / 256) * LEVELS));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (kind === "vector") {
        const [cb, cr] = chroma(r, g, b);
        const cx = Math.floor(((cb + 1) / 2) * VECTOR_SIDE);
        const cy = Math.floor(((1 - cr) / 2) * VECTOR_SIDE);
        if (cx >= 0 && cx < VECTOR_SIDE && cy >= 0 && cy < VECTOR_SIDE) {
          grid[cy * VECTOR_SIDE + cx]! += 1;
        }
      } else if (kind === "wave") {
        const col = Math.min(WAVE_COLUMNS - 1, Math.floor((x / width) * WAVE_COLUMNS));
        grid[level(luma(r, g, b)) * cols + col]! += 1;
      } else {
        const col = Math.min(channelCols - 1, Math.floor((x / width) * channelCols));
        grid[level(r) * cols + col]! += 1;
        grid[level(g) * cols + PARADE_COLUMNS + col]! += 1;
        grid[level(b) * cols + PARADE_COLUMNS * 2 + col]! += 1;
      }
    }
  }
  // A cell's crowd against the pixels that can land in it: the column's for traces, 1/64 of the frame for the vectorscope.
  const gain = kind === "vector" ? 40 / Math.max(1, width * height) : 24 / perColumn;
  for (let i = 0; i < grid.length; i++) grid[i] = Math.min(1, Math.sqrt(grid[i]! * gain));
  return grid;
}

/** Mean saturation (chroma, 0 to 1, per pixel) under which a picture has no color to measure: skinDistance is null. */
const MIN_SKIN_WEIGHT = 0.01;

/** The vectorscope's skin line, degrees counter-clockwise from +Cb. */
export const SKIN_LINE = 123;

/**
 * Numbers for a frame. r, g, b: min, max and mean of the 8-bit channel, 0..255. clipped: the share
 * (0..1) of pixels whose luma is at or under 1% (low) or at or over 99% (high). histogram: 16
 * buckets of luma from black to white, each a share of the pixels (they add up to 1).
 * skinDistance: the mean angle in degrees (0..180) between each pixel's hue on the vectorscope and
 * the 123° skin line, weighted by how saturated the pixel is; 0 is on the line. A frame with no
 * color (mean chroma under 0.01 of full, about 1 level of 255) gives null.
 */
export function scopeStats(frame: ImageData): ScopeStats {
  const { data } = frame;
  const count = Math.max(1, data.length / 4);
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  const sum = [0, 0, 0];
  const buckets = new Array<number>(16).fill(0);
  let low = 0;
  let high = 0;
  let angle = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c]!;
      if (v < min[c]!) min[c] = v;
      if (v > max[c]!) max[c] = v;
      sum[c]! += v;
    }
    const l = luma(data[i]!, data[i + 1]!, data[i + 2]!);
    buckets[Math.min(15, Math.floor((l / 256) * 16))]! += 1;
    if (l <= 2.55) low++;
    if (l >= 252.45) high++;
    const [cb, cr] = chroma(data[i]!, data[i + 1]!, data[i + 2]!);
    const strength = Math.hypot(cb, cr);
    if (strength > 0) {
      const hue = (Math.atan2(cr, cb) * 180) / Math.PI;
      const apart = Math.abs(((((hue - SKIN_LINE) % 360) + 540) % 360) - 180);
      angle += apart * strength;
      weight += strength;
    }
  }
  const channel = (c: number): ChannelStats => ({
    min: min[c]!,
    max: max[c]!,
    mean: Math.round((sum[c]! / count) * 10) / 10,
  });
  const share = (n: number) => Math.round((n / count) * 1000) / 1000;
  return {
    r: channel(0),
    g: channel(1),
    b: channel(2),
    clipped: { low: share(low), high: share(high) },
    histogram: buckets.map(share),
    skinDistance: weight / count >= MIN_SKIN_WEIGHT ? Math.round((angle / weight) * 10) / 10 : null,
  };
}
