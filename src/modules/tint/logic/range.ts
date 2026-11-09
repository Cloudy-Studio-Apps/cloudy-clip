import type { RangePart, RangeWindow } from "../tint.types";

// A range bar's window (two ends as shares of the bar), as Limit's bars show and drag it. A hue
// bar wraps: a window whose `from` is past its `to` runs over the bar's end and on from its start.

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
const round = (x: number, step: number) => Number((Math.round(x / step) * step).toFixed(4));

/** What a press at `x` (a share of the bar) grabs: an end within `slop` of it, else the window, else the nearer end. */
export function grabPart(
  [from, to]: RangeWindow,
  x: number,
  slop: number,
  wrap: boolean,
): RangePart {
  const away = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return wrap ? Math.min(d, 1 - d) : d;
  };
  const dFrom = away(x, from);
  const dTo = away(x, to);
  if (Math.min(dFrom, dTo) <= slop) return dFrom <= dTo ? "from" : "to";
  const inside = from <= to ? x >= from && x <= to : x >= from || x <= to;
  if (inside) return "move";
  return dFrom <= dTo ? "from" : "to";
}

/** CSS gradient stops shading what lies outside the window with `shade`, clear inside. */
export function outsideStops([from, to]: RangeWindow, shade: string): string {
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
  const clear = "transparent";
  return from <= to
    ? `${shade} 0%, ${shade} ${pct(from)}, ${clear} ${pct(from)}, ${clear} ${pct(to)}, ${shade} ${pct(to)}, ${shade} 100%`
    : `${clear} 0%, ${clear} ${pct(to)}, ${shade} ${pct(to)}, ${shade} ${pct(from)}, ${clear} ${pct(from)}, ${clear} 100%`;
}

/**
 * A range bar's window dragged by `delta` (a share of the bar): one end, or the whole window.
 * On a plain bar the ends stay in 0…1 and in order; on a hue bar (`wrap`) the window turns
 * around the bar, and its width stays 0 to the whole bar (then `[0, 1]`).
 */
export function dragWindow(
  [from, to]: RangeWindow,
  part: RangePart,
  delta: number,
  wrap: boolean,
): RangeWindow {
  if (!wrap) {
    if (part === "from") return [clamp01(Math.min(from + delta, to)), to];
    if (part === "to") return [from, clamp01(Math.max(to + delta, from))];
    const d = Math.min(Math.max(delta, -from), 1 - to);
    return [from + d, to + d];
  }
  const width = to >= from ? to - from : to - from + 1;
  let a = from;
  let b = from + width;
  if (part === "from") a = Math.min(Math.max(a + delta, b - 1), b);
  else if (part === "to") b = Math.min(Math.max(b + delta, a), a + 1);
  else {
    a += delta;
    b += delta;
  }
  if (b - a >= 1) return [0, 1];
  const turn = (x: number) => x - Math.floor(x);
  return [turn(a), b - a === 0 ? turn(a) : turn(b) === 0 ? 1 : turn(b)];
}

/** A hue window in degrees as a range bar's window (shares of the hue strip). */
export function hueBar([a, b]: readonly [number, number]): [number, number] {
  return [a / 360, b / 360];
}

/** A hue strip's window as degrees, rounded to a tenth; the whole strip is `[0, 360]`. */
export function barHue([from, to]: readonly [number, number]): [number, number] {
  if (from === 0 && to === 1) return [0, 360];
  return [round(from * 360, 0.1) % 360, round(to * 360, 0.1)];
}

/** A 0…1 bar's window as stored, rounded to a thousandth. */
export function barPair([from, to]: readonly [number, number]): [number, number] {
  return [round(from, 0.001), round(to, 0.001)];
}

/** A 0…1 window as percents, `"22–64"`. */
export function percents([from, to]: RangeWindow): string {
  return `${Math.round(from * 100)}–${Math.round(to * 100)}`;
}
