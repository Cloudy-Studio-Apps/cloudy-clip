import type { Rgb, Warper, WarpOffset, WarpPlace } from "../../tint.types";
import { CB, CHROMA_FULL, CR, LUMA, NO_HUE, luma } from "./basics";
import { cbcrHue, half } from "./curves.apply";

// The warper, as the CPU reference of the shader's warp step (after the curves and Color mix,
// before saturation, vibrance and hue). It moves each color on a disc of hue (around) and strength
// (out from gray), the way its grid of points was dragged.
//
// - The grid: 12 hues by 3 rings, plus the center (gray), which never moves. Point `index` is
//   `ring · 12 + spoke`: spoke `k` (0…11) sits at hue `k / 12` of a turn (the hue curves' hue, red
//   at 0, `cbcrHue`), ring `r` (0 inner, 1 middle, 2 outer) at strength `(r + 1) / 3`, strength 1
//   being chroma 0.5 (`CHROMA_FULL`). So 0…11 is the inner ring, 12…23 the middle, 24…35 the outer.
// - A stored point `{ dh, ds }` moves that grid point by `dh` degrees of hue and `ds` of strength.
// - Smoothing (0…100): every point that isn't stored or pinned follows the stored ones, each by
//   `w = exp(-(d / σ)²)`, `d` the distance in grid steps (spokes around, rings out), `σ = 3 ·
//   smoothing / 100`; the offsets are summed by weight, divided by the weights when they add up past
//   1. A pinned point never follows; it keeps its own offset (none unless stored).
// - Between grid points the offset is bilinear: around between two spokes, out between two rings,
//   from nothing at the center to the inner ring, and as the outer ring past it.
// - A color then turns by its offset's hue and its strength becomes `max(s + ds, 0)`; luma is kept.
//   Grays (chroma under `NO_HUE`) stay.
// - The shader reads the offsets from a table of 180 hues by 32 strengths (hue `i / 179`, strength
//   `j / 31`, 0…1), rounded to half-floats; the reference reads the same table the same way.

/** Hues around the grid. */
export const WARP_HUES = 12;
/** Rings of the grid, out from the center. */
export const WARP_RINGS = 3;
/** Size of the warp table: hues by strengths. */
export const WARP_TABLE = { width: 180, height: 32 } as const;

const NONE: WarpOffset = { dh: 0, ds: 0 };

/** Where grid point `index` sits before it is moved. */
export function warpNode(index: number): WarpPlace {
  return {
    hue: (index % WARP_HUES) / WARP_HUES,
    strength: (Math.floor(index / WARP_HUES) + 1) / WARP_RINGS,
  };
}

/** Whether the warper moves anything. */
export function warperActive(warper: Warper): boolean {
  return Object.values(warper.points).some((p) => p.dh !== 0 || p.ds !== 0);
}

/** Grid steps between two grid points: spokes around (the short way) and rings out. */
function steps(a: number, b: number): number {
  const around = Math.abs((a % WARP_HUES) - (b % WARP_HUES));
  const out = Math.floor(a / WARP_HUES) - Math.floor(b / WARP_HUES);
  return Math.hypot(Math.min(around, WARP_HUES - around), out);
}

/** How far each grid point moves (`dh` in turns), the stored ones and those following them. */
export function warpNodes(warper: Warper): WarpOffset[] {
  const stored = Object.entries(warper.points).map(([key, p]) => ({
    index: Number(key),
    dh: p.dh / 360,
    ds: p.ds,
  }));
  const pinned = new Set(warper.pinned);
  const sigma = (3 * warper.smoothing) / 100;
  return Array.from({ length: WARP_HUES * WARP_RINGS }, (_, index): WarpOffset => {
    const own = stored.find((p) => p.index === index);
    if (own) return { dh: own.dh, ds: own.ds };
    if (pinned.has(index) || sigma <= 0) return NONE;
    let dh = 0;
    let ds = 0;
    let weights = 0;
    for (const p of stored) {
      const w = Math.exp(-((steps(index, p.index) / sigma) ** 2));
      dh += w * p.dh;
      ds += w * p.ds;
      weights += w;
    }
    const k = weights > 1 ? 1 / weights : 1;
    return { dh: dh * k, ds: ds * k };
  });
}

/** The offset at any place of the disc, bilinear between the grid points `nodes` (`warpNodes`). */
export function warpAt(nodes: readonly WarpOffset[], place: WarpPlace): WarpOffset {
  const around = (place.hue - Math.floor(place.hue)) * WARP_HUES;
  const k0 = Math.floor(around) % WARP_HUES;
  const k1 = (k0 + 1) % WARP_HUES;
  const f = around - Math.floor(around);
  const out = Math.min(Math.max(place.strength, 0), 1) * WARP_RINGS;
  const ring = Math.min(Math.floor(out), WARP_RINGS - 1);
  const g = out - ring;
  const at = (r: number, k: number): WarpOffset => (r < 0 ? NONE : nodes[r * WARP_HUES + k]!);
  const lerp = (a: WarpOffset, b: WarpOffset, t: number): WarpOffset => ({
    dh: a.dh + (b.dh - a.dh) * t,
    ds: a.ds + (b.ds - a.ds) * t,
  });
  const inner = lerp(at(ring - 1, k0), at(ring - 1, k1), f);
  const outer = lerp(at(ring, k0), at(ring, k1), f);
  return lerp(inner, outer, g);
}

/**
 * The warper sampled for the shader: `WARP_TABLE` hues by strengths, two values each (`dh` in
 * turns, `ds`), row by row of strength, rounded to half-floats as the texture holds them.
 */
export function sampleWarper(warper: Warper): Float32Array {
  const { width, height } = WARP_TABLE;
  const nodes = warpNodes(warper);
  const table = new Float32Array(width * height * 2);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const o = warpAt(nodes, { hue: i / (width - 1), strength: j / (height - 1) });
      table[(j * width + i) * 2] = half(o.dh);
      table[(j * width + i) * 2 + 1] = half(o.ds);
    }
  }
  return table;
}

/** The table at a hue (0…1) and strength (clamped to 0…1), bilinear as the texture is read. */
export function warpTableAt(table: Float32Array, hue: number, strength: number): WarpOffset {
  const { width, height } = WARP_TABLE;
  const x = hue * (width - 1);
  const i = Math.min(Math.max(Math.floor(x), 0), width - 2);
  const fx = x - i;
  const y = Math.min(Math.max(strength, 0), 1) * (height - 1);
  const j = Math.min(Math.floor(y), height - 2);
  const fy = y - j;
  const read = (c: number) => {
    const v = (a: number, b: number) => table[(b * width + a) * 2 + c]!;
    const low = v(i, j) + (v(i + 1, j) - v(i, j)) * fx;
    const high = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * fx;
    return low + (high - low) * fy;
  };
  return { dh: read(0), ds: read(1) };
}

/** One pixel through the warper table: its hue turned, its strength moved, luma kept. */
export function applyWarper(c: Rgb, table: Float32Array): Rgb {
  const y = luma(c);
  let cb = (c[2] - y) / CB;
  let cr = (c[0] - y) / CR;
  const length = Math.hypot(cb, cr);
  if (length <= NO_HUE) return c;
  const s = length / CHROMA_FULL;
  const { dh, ds } = warpTableAt(table, cbcrHue(cb, cr), s);
  const k = Math.max(s + ds, 0) / s;
  const turn = dh * 2 * Math.PI;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const turnedCb = (cos * cb - sin * cr) * k;
  cr = (sin * cb + cos * cr) * k;
  cb = turnedCb;
  const r = y + CR * cr;
  const b = y + CB * cb;
  return [r, (y - LUMA[0] * r - LUMA[2] * b) / LUMA[1], b];
}
