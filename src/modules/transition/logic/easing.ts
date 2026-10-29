/** Cubic ease-in-out of `t` in 0..1. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** A triangle 0 → 1 → 0 over `t` in 0..1, peaking at 0.5. */
export function bump(t: number): number {
  return 1 - Math.abs(2 * Math.min(1, Math.max(0, t)) - 1);
}
