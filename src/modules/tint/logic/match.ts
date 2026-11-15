import type { ClipGrade, CorrectionValues, GradeNodeId } from "@/modules/project";
import type { NodeSample, Rgb } from "../tint.types";
import { logish, toYcc, unlogish } from "./color/basics";
import { applyCorrection, prepareCorrection } from "./color/correct";
import { WHEEL_REACH, wheelChannels, wheelFor } from "./color/wheels";
import { layerIds } from "./layers";
import { toStack } from "./stack";

// The solvers of `tint.match`, on the CPU reference as the forward model (`applyCorrection`): they
// look for values whose result is right, rather than undoing the math by hand, so whatever else
// the correction holds is taken into account. Every value comes out inside `GRADE_RANGES`.

/** What balance writes: the correction's temperature, tint and offset. */
type Balance = Pick<CorrectionValues, "temperature" | "tint" | "offset">;

/** How much of the darkest end auto balance puts at black, per channel. */
const BLACK_SHARE = 0.005;

const round = (v: number, places = 4) => Math.round(v * 10 ** places) / 10 ** places;

/** The mean of samples through a correction with these values, as it draws (its LUT, opacity and key included: `mix`). */
function meanOut(values: CorrectionValues, samples: readonly NodeSample[]): Rgb {
  const p = prepareCorrection(values);
  const sum: Rgb = [0, 0, 0];
  for (const { rgb, at, mix } of samples) {
    const out = mix(applyCorrection(rgb, p, at));
    sum[0] += out[0];
    sum[1] += out[1];
    sum[2] += out[2];
  }
  const n = Math.max(samples.length, 1);
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/** Cb and Cr of a color: 0 and 0 is neutral. */
function chromaOf(rgb: Rgb): [number, number] {
  const [, cb, cr] = toYcc(rgb);
  return [cb, cr];
}

/**
 * Newton's method on two unknowns `p` (each kept in `lo`…`hi`) driving the two numbers `f` gives
 * to 0, with a Jacobian by finite differences and a step halved until it helps. Gives the best `p`
 * found: where a range stops it, as near as that range allows.
 */
export function solve2(
  f: (p: [number, number]) => [number, number],
  start: [number, number],
  lo: number,
  hi: number,
): [number, number] {
  const clamp = (v: number) => Math.min(Math.max(v, lo), hi);
  const size = (r: [number, number]) => Math.hypot(r[0], r[1]);
  const h = (hi - lo) * 1e-4;
  let p: [number, number] = [clamp(start[0]), clamp(start[1])];
  let r = f(p);
  for (let i = 0; i < 40 && size(r) > 1e-7; i++) {
    const a = f([p[0] + h, p[1]]);
    const b = f([p[0], p[1] + h]);
    const j = [(a[0] - r[0]) / h, (b[0] - r[0]) / h, (a[1] - r[1]) / h, (b[1] - r[1]) / h];
    const det = j[0]! * j[3]! - j[1]! * j[2]!;
    if (Math.abs(det) < 1e-12) break;
    const d0 = (j[3]! * r[0] - j[1]! * r[1]) / det;
    const d1 = (-j[2]! * r[0] + j[0]! * r[1]) / det;
    let step = 1;
    let better = false;
    for (let k = 0; k < 8; k++, step /= 2) {
      const q: [number, number] = [clamp(p[0] - d0 * step), clamp(p[1] - d1 * step)];
      const rq = f(q);
      if (size(rq) < size(r)) {
        p = q;
        r = rq;
        better = true;
        break;
      }
    }
    if (!better) break;
  }
  return p;
}

/** Temperature and tint that make the samples' mean neutral, the rest kept. */
function byGains(values: CorrectionValues, samples: readonly NodeSample[]): CorrectionValues {
  const at = (p: [number, number]) => ({ ...values, temperature: p[0], tint: p[1] });
  const [temperature, tint] = solve2(
    (p) => chromaOf(meanOut(at(p), samples)),
    [values.temperature, values.tint],
    -100,
    100,
  );
  return at([round(temperature, 2), round(tint, 2)]);
}

/** Offset's color that makes the samples' mean neutral, its master ring kept. */
function byOffset(values: CorrectionValues, samples: readonly NodeSample[]): CorrectionValues {
  const at = (p: [number, number]) => ({
    ...values,
    offset: { ...values.offset, x: p[0], y: p[1] },
  });
  const [x, y] = solve2(
    (p) => chromaOf(meanOut(at(p), samples)),
    [values.offset.x, values.offset.y],
    -1,
    1,
  );
  return at([round(x), round(y)]);
}

/** Offset that puts the darkest `BLACK_SHARE` of each channel at 0. */
function blackPoint(values: CorrectionValues, samples: readonly NodeSample[]): CorrectionValues {
  const p = prepareCorrection(values);
  const outs = samples.map(({ rgb, at, mix }) => mix(applyCorrection(rgb, p, at)));
  const low = [0, 1, 2].map((c) => {
    const sorted = outs.map((o) => o[c as 0 | 1 | 2]).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * BLACK_SHARE)] ?? 0;
  });
  const now = wheelChannels(values.offset, WHEEL_REACH.offset);
  const offset = wheelFor(
    [now[0] - low[0]!, now[1] - low[1]!, now[2] - low[2]!],
    WHEEL_REACH.offset,
  );
  return { ...values, offset: { x: round(offset.x), y: round(offset.y), m: round(offset.m) } };
}

/**
 * Balance of a correction whose input the samples are (each through the corrections above it):
 * - `white`: what was picked comes out neutral, by temperature and tint (a gain on the light, so
 *   black stays black), then offset's color for what their ranges can't reach.
 * - `gray`: the same, offset's color first (an even shift, the usual balance on a mid gray), then
 *   temperature and tint for the rest.
 * - `auto` (the whole picture): offset puts the darkest half percent of each channel at 0 (neutral
 *   blacks, the spread used), and temperature and tint make the mean neutral (gray world); three
 *   rounds, as each moves the other a little.
 * The correction's other values stay and are part of the model, and so do its LUT, opacity and key
 * (each sample's `mix`), so the result is neutral as the grade draws. Null without samples.
 */
export function balanceValues(
  values: CorrectionValues,
  samples: readonly NodeSample[],
  kind: "auto" | "white" | "gray",
): Balance | null {
  if (samples.length === 0) return null;
  let v = values;
  if (kind === "white") v = byOffset(byGains(v, samples), samples);
  else if (kind === "gray") v = byGains(byOffset(v, samples), samples);
  else for (let i = 0; i < 3; i++) v = byGains(blackPoint(v, samples), samples);
  return { temperature: v.temperature, tint: v.tint, offset: v.offset };
}

/** Mean and spread (standard deviation) of numbers. */
function stats(xs: readonly number[]): { mean: number; spread: number } {
  const mean = xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
  const vari = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(xs.length, 1);
  return { mean, spread: Math.sqrt(vari) };
}

/** Mean CbCr length. */
const meanChroma = (colors: readonly Rgb[]) =>
  stats(colors.map((c) => Math.hypot(...chromaOf(c)))).mean;

/**
 * A correction that makes `target` (the clip's picture through its whole grade) look like
 * `reference` (the other clip's, through its own): per channel, the mean and spread of
 * `logish(x)` are matched (`(lg − μt) σr / σt + μr`), and that mapping, back in display values, is
 * fitted by least squares with a straight line `g x + o`: the gain wheel (`2^n`) and offset of a
 * fresh correction. Then saturation is the reference's mean chroma over the target's after that
 * line. Clamped into their ranges. Null when either has no samples.
 */
export function shotValues(
  target: readonly Rgb[],
  reference: readonly Rgb[],
): Pick<CorrectionValues, "gain" | "offset" | "saturation"> | null {
  if (target.length === 0 || reference.length === 0) return null;
  const gains: Rgb = [1, 1, 1];
  const offsets: Rgb = [0, 0, 0];
  for (const c of [0, 1, 2] as const) {
    const t = target.map((x) => x[c]);
    const lt = stats(t.map(logish));
    const lr = stats(reference.map((x) => logish(x[c])));
    const scale = lt.spread > 1e-4 ? lr.spread / lt.spread : 1;
    const want = t.map((x) => unlogish((logish(x) - lt.mean) * scale + lr.mean));
    const st = stats(t);
    const mw = stats(want).mean;
    const cov = t.reduce((a, x, i) => a + (x - st.mean) * (want[i]! - mw), 0) / t.length;
    const g = st.spread > 1e-4 ? cov / st.spread ** 2 : 1;
    gains[c] = g;
    offsets[c] = mw - g * st.mean;
  }
  const gainWheel = wheelFor(
    gains.map((g) => Math.log2(Math.max(g, 1e-3))) as Rgb,
    WHEEL_REACH.gain,
  );
  const offsetWheel = wheelFor(offsets, WHEEL_REACH.offset);
  const g = wheelChannels(gainWheel, WHEEL_REACH.gain).map((n) => 2 ** n);
  const o = wheelChannels(offsetWheel, WHEEL_REACH.offset);
  const mapped = target.map((x) => x.map((v, c) => g[c]! * v + o[c]!) as Rgb);
  const before = meanChroma(mapped);
  const saturation = before > 1e-4 ? Math.min(Math.max(meanChroma(reference) / before, 0), 2) : 1;
  const tidy = (w: { x: number; y: number; m: number }) => ({
    x: round(w.x),
    y: round(w.y),
    m: round(w.m),
  });
  return { gain: tidy(gainWheel), offset: tidy(offsetWheel), saturation: round(saturation) };
}

/** The correction balance writes into when none is named: the first of the stack (as the tools edit), or null. */
export function currentCorrection(grade: ClipGrade | null): GradeNodeId | null {
  return layerIds(toStack(grade)).find((id) => grade?.nodes[id]?.kind === "correct") ?? null;
}

/** The next "Match nn" name of a grade: one past the highest there. */
export function nextMatchName(grade: ClipGrade | null): string {
  let most = 0;
  for (const node of Object.values(grade?.nodes ?? {})) {
    const n = node.kind === "correct" ? /^Match (\d+)$/.exec(node.name ?? "")?.[1] : undefined;
    if (n) most = Math.max(most, Number(n));
  }
  return `Match ${String(most + 1).padStart(2, "0")}`;
}
