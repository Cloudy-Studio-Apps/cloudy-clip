import type { CorrectionValues } from "@/modules/project";
import type { ChartCorners, FramePoint, Rgb } from "../tint.types";
import { WHEEL_REACH, wheelFor } from "./color/wheels";
import { srgbToDisplay } from "./color/spaces";

/**
 * The patches of the classic 24-patch chart, in reading order (six across, four down, dark skin
 * first, black last), as 8-bit sRGB: BabelColor's averages of measured charts, D65 (Danny Pascale,
 * BabelColor, the chart's sRGB table).
 */
const CHART_SRGB: readonly (readonly [number, number, number])[] = [
  [115, 82, 68], // dark skin
  [194, 150, 130], // light skin
  [98, 122, 157], // blue sky
  [87, 108, 67], // foliage
  [133, 128, 177], // blue flower
  [103, 189, 170], // bluish green
  [214, 126, 44], // orange
  [80, 91, 166], // purplish blue
  [193, 90, 99], // moderate red
  [94, 60, 108], // purple
  [157, 188, 64], // yellow green
  [224, 163, 46], // orange yellow
  [56, 61, 150], // blue
  [70, 148, 73], // green
  [175, 54, 60], // red
  [231, 199, 31], // yellow
  [187, 86, 149], // magenta
  [8, 133, 161], // cyan
  [243, 243, 242], // white 9.5
  [200, 200, 200], // neutral 8
  [160, 160, 160], // neutral 6.5
  [122, 122, 121], // neutral 5
  [85, 85, 85], // neutral 3.5
  [52, 52, 52], // black 2
];

/** The chart's patches as sRGB 0…1, in reading order. */
export const CHART_REFERENCE: readonly Rgb[] = CHART_SRGB.map((c) => [
  c[0] / 255,
  c[1] / 255,
  c[2] / 255,
]);

/** Columns and rows of the chart. */
export const CHART_GRID = { columns: 6, rows: 4 } as const;

/** Share of a patch's width and height read around its centre. */
const PATCH_CORE = 0.4;
/** Points read across that core, each way. */
const PATCH_READS = 3;

/** A point of the quad at `(s, t)` (0…1 across, 0…1 down), by bilinear mapping of its corners. */
export function quadPoint(corners: ChartCorners, s: number, t: number): FramePoint {
  const [a, b, c, d] = corners;
  const u = (1 - s) * (1 - t) * a.u + s * (1 - t) * b.u + s * t * c.u + (1 - s) * t * d.u;
  const v = (1 - s) * (1 - t) * a.v + s * (1 - t) * b.v + s * t * c.v + (1 - s) * t * d.v;
  return { u, v };
}

/** Where patch `index` (reading order) is read: a small grid over its centre. */
export function patchPoints(corners: ChartCorners, index: number): FramePoint[] {
  const col = index % CHART_GRID.columns;
  const row = Math.floor(index / CHART_GRID.columns);
  const points: FramePoint[] = [];
  for (let i = 0; i < PATCH_READS; i++) {
    for (let j = 0; j < PATCH_READS; j++) {
      const ds = ((i + 0.5) / PATCH_READS - 0.5) * PATCH_CORE;
      const dt = ((j + 0.5) / PATCH_READS - 0.5) * PATCH_CORE;
      points.push(
        quadPoint(
          corners,
          (col + 0.5 + ds) / CHART_GRID.columns,
          (row + 0.5 + dt) / CHART_GRID.rows,
        ),
      );
    }
  }
  return points;
}

/** The quad's area as a share of the frame (`aspect` its width over height, so it is in square units). */
export function quadArea(corners: ChartCorners, aspect: number): number {
  let twice = 0;
  for (let i = 0; i < 4; i++) {
    const p = corners[i]!;
    const q = corners[(i + 1) % 4]!;
    twice += p.u * aspect * q.v - q.u * aspect * p.v;
  }
  return Math.abs(twice) / 2 / aspect;
}

/** `x` with `A x = b` by Gaussian elimination with partial pivoting; null when `A` is (nearly) singular. */
export function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  const scale = Math.max(...m.map((row, i) => Math.abs(row[i]!)), 1e-30);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i]![k]!) > Math.abs(m[p]![k]!)) p = i;
    if (Math.abs(m[p]![k]!) < scale * 1e-9) return null;
    [m[k], m[p]] = [m[p]!, m[k]!];
    for (let i = k + 1; i < n; i++) {
      const f = m[i]![k]! / m[k]![k]!;
      for (let j = k; j <= n; j++) m[i]![j]! -= f * m[k]![j]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = m[i]![n]!;
    for (let j = i + 1; j < n; j++) s -= m[i]![j]! * x[j]!;
    x[i] = s / m[i]![i]!;
  }
  return x;
}

/**
 * The 3 × 3 matrix and offsets (`out = M x + b`) that bring the measured patches nearest the
 * targets, least squares over the 24: each output channel regressed on the measured r, g, b and 1
 * (4 × 4 normal equations). Null when the patches don't span the colors (too alike to solve).
 */
export function fitChart(
  measured: readonly Rgb[],
  targets: readonly Rgb[],
): { matrix: [number, number, number][]; bias: Rgb } | null {
  const ata = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
  const atb = [0, 1, 2].map(() => [0, 0, 0, 0]);
  measured.forEach((m, i) => {
    const row = [m[0], m[1], m[2], 1];
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) ata[j]![k]! += row[j]! * row[k]!;
      for (let c = 0; c < 3; c++) atb[c]![j]! += row[j]! * targets[i]![c]!;
    }
  });
  const rows = atb.map((b) => solveLinear(ata, b));
  if (rows.some((r) => r === null)) return null;
  const w = rows as number[][];
  return {
    matrix: w.map((r) => [r[0]!, r[1]!, r[2]!]),
    bias: [w[0]![3]!, w[1]![3]!, w[2]![3]!],
  };
}

/** The chart's targets in the grade's space: sRGB display light, for the Rec.709 gamma 2.4 output. */
export const chartTargets = (): Rgb[] => CHART_REFERENCE.map((c) => c.map(srgbToDisplay) as Rgb);

/** The mixer's range: a fitted cell outside it means the patches didn't pin the matrix down. */
const MIXER_LIMIT = 2;
/** Largest root-mean-square miss of the fit over the patches: past it, the corners aren't on a chart. */
const CHART_MISS = 0.08;

/**
 * The values of a fresh "Chart" correction from the measured patches (each the mean of its reads,
 * through what comes before the correction): the RGB mixer holds the fitted matrix (keep
 * brightness off, so it is used as it is). The mixer has no offsets, so they go into the same
 * correction's offset wheel, which runs before the mixer: `M (x + o) = M x + b` gives
 * `o = M⁻¹ b`. Null (refused, never clamped cell by cell) when the fit can't be solved, a cell
 * falls outside the mixer's -2…2 (patches too alike, as a gray card, pin nothing down) or the fit
 * misses the patches by more than `CHART_MISS` (root mean square).
 */
export function chartValues(
  measured: readonly Rgb[],
): Pick<CorrectionValues, "mixer" | "offset"> | null {
  const targets = chartTargets();
  const fit = fitChart(measured, targets);
  if (!fit || fit.matrix.flat().some((v) => Math.abs(v) > MIXER_LIMIT)) return null;
  let miss = 0;
  measured.forEach((m, i) => {
    for (const c of [0, 1, 2] as const) {
      const row = fit.matrix[c]!;
      const out = row[0] * m[0] + row[1] * m[1] + row[2] * m[2] + fit.bias[c];
      miss += (out - targets[i]![c]) ** 2;
    }
  });
  if (Math.sqrt(miss / (measured.length * 3)) > CHART_MISS) return null;
  const round = (v: number) => Math.round(v * 1e4) / 1e4;
  const matrix = fit.matrix.map((row) => row.map(round)) as [number, number, number][];
  const o = solveLinear(matrix, [...fit.bias]);
  if (!o) return null;
  const offset = wheelFor(o as Rgb, WHEEL_REACH.offset);
  return {
    mixer: { matrix, keepBrightness: false, mono: false },
    offset: { x: round(offset.x), y: round(offset.y), m: round(offset.m) },
  };
}
