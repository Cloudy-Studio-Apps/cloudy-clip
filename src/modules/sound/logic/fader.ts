import { VOLUME_DB_MAX, VOLUME_DB_MIN, panSide } from "@/modules/project";

/**
 * The fader's taper: positions (0 bottom, 1 top) of some levels in dB, straight lines between.
 * Unity sits at three quarters, as on a console, so the useful range gets most of the travel.
 */
const TAPER: readonly (readonly [db: number, position: number])[] = [
  [VOLUME_DB_MIN, 0],
  [-30, 0.25],
  [-12, 0.5],
  [0, 0.75],
  [VOLUME_DB_MAX, 1],
];

/** Where a level sits along a fader, 0 to 1. */
export function faderPosition(db: number): number {
  return along(db, 0, 1);
}

/** The level at a position along a fader, rounded to a tenth of a dB. */
export function faderDb(position: number): number {
  return Math.round(along(position, 1, 0) * 10) / 10;
}

/** Interpolates the taper from column `from` to column `to`, clamped at its ends. */
function along(value: number, from: 0 | 1, to: 0 | 1): number {
  const first = TAPER[0]!;
  if (value <= first[from]) return first[to];
  for (let i = 1; i < TAPER.length; i++) {
    const a = TAPER[i - 1]!;
    const b = TAPER[i]!;
    if (value <= b[from]) {
      return a[to] + ((value - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
    }
  }
  return TAPER[TAPER.length - 1]![to];
}

/** Where a pan sits along its slider, 0 (left) to 1 (right). */
export function panPosition(pan: number): number {
  return Math.min(1, Math.max(0, (pan + 1) / 2));
}

/** The pan at a position along its slider, rounded to a hundredth. */
export function panAt(position: number): number {
  return Math.round((Math.min(1, Math.max(0, position)) * 2 - 1) * 100) / 100;
}

/** A pan for people: "C", or "L 40" / "R 25". */
export function formatPan(pan: number): string {
  const side = panSide(pan);
  return side === "C" ? side : `${side} ${Math.round(Math.abs(pan) * 100)}`;
}
