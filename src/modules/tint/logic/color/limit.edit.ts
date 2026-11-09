import type { GradeLimit } from "@/modules/project";
import type { Rgb } from "../../tint.types";
import { CB, CHROMA_FULL, CR, NO_HUE, luma } from "./basics";
import { cbcrHue } from "./curves.apply";
import { HUE_SOFT, RANGE_SOFT, keyOf } from "./limit";

// What Limit's controls do to a limit, every result valid for `validateGrade` (`LIMIT_RANGES`).
// The dropper sets the color ranges around the picked color, `PICK_REACH` either side; + widens
// each range just enough to take the color in, `PICK_MARGIN` past it; − cuts the one range where
// the color is nearest an end, so it falls `PICK_MARGIN` and the soft edge outside.

/** How far each color range reaches either side of a picked color: hue in degrees. */
export const PICK_REACH = { hue: 12, sat: 0.2, lum: 0.25 } as const;
/** How far past a color + and − put a range's end. */
export const PICK_MARGIN = { hue: 4, sat: 0.04, lum: 0.04 } as const;
/** The color softness a first pick starts with. */
export const PICK_SOFT = 25;
/** The brightness bands of Darks, Mids and Brights, in luma. */
export const BRIGHT_BANDS = {
  darks: [0, 0.3],
  mids: [0.3, 0.7],
  brights: [0.7, 1],
} as const satisfies Record<string, readonly [number, number]>;
/** The softness the brightness part starts with. */
export const BRIGHT_SOFT_START = 30;

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const round = (x: number, step: number) => Number((Math.round(x / step) * step).toFixed(4));
/** The hue's rounding step in degrees: a window this close to empty or whole is taken as such. */
const HUE_STEP = 0.1;
/** Degrees to 0…360, rounded to a tenth. */
const degrees = (x: number) => round(((x % 360) + 360) % 360, 0.1);

/** A color's hue in degrees (null for a gray), saturation and brightness as a limit reads them. */
export function colorOf(rgb: Rgb): { hue: number | null; sat: number; lum: number } {
  const y = luma(rgb);
  const cb = (rgb[2] - y) / CB;
  const cr = (rgb[0] - y) / CR;
  const len = Math.hypot(cb, cr);
  return {
    hue: len > NO_HUE ? cbcrHue(cb, cr) * 360 : null,
    sat: clamp01(len / CHROMA_FULL),
    lum: clamp01(y),
  };
}

/** A pair around `x`, `reach` either side, kept in 0…1 and rounded. */
const around = (x: number, reach: number): [number, number] => [
  round(clamp01(x - reach), 0.001),
  round(clamp01(x + reach), 0.001),
];

/** The color part a color is picked into, from scratch: the color part of the limit replaced. */
export function pickLimit(limit: GradeLimit | undefined, rgb: Rgb): GradeLimit {
  const { hue, sat, lum } = colorOf(rgb);
  const color: GradeLimit["color"] = {
    on: true,
    hue: hue === null ? [0, 360] : [degrees(hue - PICK_REACH.hue), degrees(hue + PICK_REACH.hue)],
    sat: around(sat, PICK_REACH.sat),
    lum: around(lum, PICK_REACH.lum),
    soft: limit?.color?.soft ?? PICK_SOFT,
  };
  return { ...limit, color };
}

/** How far along a hue window (`[a, b]` degrees, wrapping) `h` is, and the window's width. */
function alongHue([a, b]: readonly [number, number], h: number): { at: number; width: number } {
  const width = b >= a ? b - a : b - a + 360;
  return { at: (((h - a) % 360) + 360) % 360, width };
}

/** The hue window taking `h` in, widened on the nearer side. */
function widenHue(window: [number, number], h: number): [number, number] {
  const { at, width } = alongHue(window, h);
  if (at <= width) return window;
  const after = at - width + PICK_MARGIN.hue;
  const before = 360 - at + PICK_MARGIN.hue;
  // Within a rounding step of the whole circle: the whole circle (never a window of width 0).
  if (width + Math.min(after, before) >= 360 - HUE_STEP) return [0, 360];
  return after <= before
    ? [window[0], degrees(window[1] + after)]
    : [degrees(window[0] - before), window[1]];
}

/** A pair widened to take `x` in. */
function widen([a, b]: readonly [number, number], x: number, margin: number): [number, number] {
  return [
    Math.min(a, round(clamp01(x - margin), 0.001)),
    Math.max(b, round(clamp01(x + margin), 0.001)),
  ];
}

/** The limit with a color added to its color part (picked from scratch when there is none). */
export function widenLimit(limit: GradeLimit | undefined, rgb: Rgb): GradeLimit {
  const color = limit?.color;
  if (!color) return pickLimit(limit, rgb);
  const { hue, sat, lum } = colorOf(rgb);
  return {
    ...limit,
    color: {
      ...color,
      on: true,
      hue: hue === null ? color.hue : widenHue(color.hue, hue),
      sat: widen(color.sat, sat, PICK_MARGIN.sat),
      lum: widen(color.lum, lum, PICK_MARGIN.lum),
    },
  };
}

/**
 * Cuts `[a, b]` (0…1) so `x` falls out past the nearer end; null when `x` is past the soft edge
 * `edge` (already out on this range) or nothing would be left.
 */
function cutPair([a, b]: readonly [number, number], x: number, edge: number, pick: number) {
  if (x < a - edge || x > b + edge) return null;
  const margin = edge + pick;
  const pair: [number, number] =
    x - a <= b - x
      ? [round(Math.min(x + margin, 1), 0.001), b]
      : [a, round(Math.max(x - margin, 0), 0.001)];
  if (pair[0] > pair[1]) return null;
  return { pair, kept: b > a ? (pair[1] - pair[0]) / (b - a) : 0 };
}

/**
 * Cuts a hue window so `h` falls out past the nearer end (the whole circle: either side of `h`);
 * null when `h` is past the soft edge `edge` (degrees) or under two rounding steps would be left
 * (the rounded ends could meet).
 */
function cutHue(window: [number, number], h: number, edge: number) {
  const { at, width } = alongHue(window, h);
  const margin = edge + PICK_MARGIN.hue;
  if (width >= 360) {
    const left = 360 - 2 * margin;
    const pair: [number, number] = [degrees(h + margin), degrees(h - margin)];
    return left >= 2 * HUE_STEP ? { pair, kept: left / 360 } : null;
  }
  // Where `h` sits from the window's start, negative in the soft rim before it.
  const from = at > width && 360 - at <= edge ? at - 360 : at;
  if (from > width + edge) return null;
  const early = from <= width / 2;
  const pair: [number, number] = early
    ? [degrees(h + margin), window[1]]
    : [window[0], degrees(h - margin)];
  const left = early ? width - from - margin : from - margin;
  if (left < 2 * HUE_STEP) return null;
  return { pair, kept: left / width };
}

/**
 * The limit with a color left out of its color part: the one range (hue, saturation or
 * brightness) where the color sits nearest an end is cut, keeping the most of that range, its end
 * put `PICK_MARGIN` and the soft edge past the color. Null
 * when there is nothing to cut: no color part on, the color already out, or every cut would leave
 * a range empty.
 */
export function narrowLimit(limit: GradeLimit | undefined, rgb: Rgb): GradeLimit | null {
  const color = limit?.color;
  if (!color?.on) return null;
  // Out already when the color part keys it 0, soft rim included: what the preview shows.
  if (keyOf(rgb, { color }) <= 0) return null;
  const { hue, sat, lum } = colorOf(rgb);
  // Cut past the soft edge too, so the color is fully out.
  const soft = color.soft / 100;
  const hueCut = hue === null ? null : cutHue(color.hue, hue, soft * HUE_SOFT * 360);
  const satCut = cutPair(color.sat, sat, soft * RANGE_SOFT, PICK_MARGIN.sat);
  const lumCut = cutPair(color.lum, lum, soft * RANGE_SOFT, PICK_MARGIN.lum);
  // Each cut keeps a share of its range; the one keeping the most wins.
  const cuts = [
    hueCut && { field: "hue" as const, ...hueCut },
    satCut && { field: "sat" as const, ...satCut },
    lumCut && { field: "lum" as const, ...lumCut },
  ].filter((cut) => cut !== null);
  const best = cuts.sort((x, y) => y.kept - x.kept)[0];
  if (!best) return null;
  return { ...limit, color: { ...color, [best.field]: best.pair } };
}

/** The band a brightness range is, if it is one of `BRIGHT_BANDS`. */
export function brightBand(
  range: readonly [number, number],
): keyof typeof BRIGHT_BANDS | undefined {
  return (Object.keys(BRIGHT_BANDS) as (keyof typeof BRIGHT_BANDS)[]).find(
    (band) => BRIGHT_BANDS[band][0] === range[0] && BRIGHT_BANDS[band][1] === range[1],
  );
}

/** The limit's color part, or the one turning it on starts with: every color (a pick then narrows it). */
export function colorPart(limit: GradeLimit | undefined): NonNullable<GradeLimit["color"]> {
  return limit?.color ?? { on: false, hue: [0, 360], sat: [0, 1], lum: [0, 1], soft: PICK_SOFT };
}

/** The limit's brightness part, or the one turning it on starts with: Brights. */
export function brightPart(limit: GradeLimit | undefined): NonNullable<GradeLimit["brightness"]> {
  return (
    limit?.brightness ?? { on: false, range: [...BRIGHT_BANDS.brights], soft: BRIGHT_SOFT_START }
  );
}

/** A limit without refine at 0 and 0; one with nothing left in it is none (null). */
export function tidyLimit(limit: GradeLimit): GradeLimit | null {
  const { refine, ...rest } = limit;
  const tidy = refine && (refine.soft > 0 || refine.clean > 0) ? limit : rest;
  return Object.keys(tidy).length === 0 ? null : tidy;
}
