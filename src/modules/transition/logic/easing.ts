/** Cubic ease-in-out of `t` in 0..1. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Quintic ease-in-out of `t` in 0..1: nearly still at both ends, very fast in the middle. */
export function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

/** `t` limited to 0..1. */
export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** A triangle 0 → 1 → 0 over `t` in 0..1, peaking at 0.5. */
export function bump(t: number): number {
  return 1 - Math.abs(2 * Math.min(1, Math.max(0, t)) - 1);
}
