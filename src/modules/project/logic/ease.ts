import type { EasePresetId, KeyEase } from "../project.types";

const bezier = (x1: number, y1: number, x2: number, y2: number): KeyEase => ({
  kind: "bezier",
  x1,
  y1,
  x2,
  y2,
});

/** The curves the strip offers, in its order. `presetOf` names a curve by looking here. */
export const EASE_PRESETS: readonly { id: EasePresetId; label: string; ease: KeyEase }[] = [
  { id: "linear", label: "Linear", ease: { kind: "linear" } },
  { id: "in", label: "Ease in", ease: bezier(0.42, 0, 1, 1) },
  { id: "out", label: "Ease out", ease: bezier(0, 0, 0.58, 1) },
  { id: "ease", label: "Ease", ease: bezier(0.42, 0, 0.58, 1) },
  { id: "snap", label: "Snap", ease: bezier(0.16, 1, 0.3, 1) },
  { id: "anticipate", label: "Anticipate", ease: bezier(0.36, 0, 0.66, -0.56) },
  { id: "overshoot", label: "Overshoot", ease: bezier(0.34, 1.56, 0.64, 1) },
  { id: "bounce", label: "Bounce", ease: { kind: "named", name: "bounce" } },
  { id: "elastic", label: "Elastic", ease: { kind: "named", name: "elastic" } },
  { id: "hold", label: "Hold", ease: { kind: "hold" } },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** y of a cubic bezier from (0,0) to (1,1) at x, by bisection on its parameter. */
function bezierY(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const at = (a: number, b: number, s: number) =>
    3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (at(x1, x2, mid) < x) low = mid;
    else high = mid;
  }
  return at(y1, y2, (low + high) / 2);
}

function bounce(u: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (u < 1 / d) return n * u * u;
  if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
  if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
  return n * (u -= 2.625 / d) * u + 0.984375;
}

function elastic(u: number): number {
  if (u === 0 || u === 1) return u;
  return 2 ** (-10 * u) * Math.sin(((u * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
}

/**
 * How far along the way between two keys the value is, for how far along the time is (`u`, 0 to
 * 1). A bezier's x is clamped to 0..1 and its y is free, so it can pass 1 or dip below 0. No ease
 * means linear.
 */
export function easeProgress(ease: KeyEase | undefined, u: number): number {
  const t = clamp01(u);
  if (ease === undefined || ease.kind === "linear") return t;
  if (ease.kind === "hold") return t < 1 ? 0 : 1;
  if (ease.kind === "named") return ease.name === "bounce" ? bounce(t) : elastic(t);
  if (t === 0 || t === 1) return t;
  return bezierY(clamp01(ease.x1), ease.y1, clamp01(ease.x2), ease.y2, t);
}

/** The preset an ease is, comparing numbers exactly; anything else is `"custom"`. */
export function presetOf(ease: KeyEase | undefined): EasePresetId | "custom" {
  if (ease === undefined) return "linear";
  for (const preset of EASE_PRESETS) {
    const p = preset.ease;
    if (p.kind !== ease.kind) continue;
    if (p.kind === "bezier" && ease.kind === "bezier") {
      if (p.x1 === ease.x1 && p.y1 === ease.y1 && p.x2 === ease.x2 && p.y2 === ease.y2) {
        return preset.id;
      }
    } else if (p.kind === "named" && ease.kind === "named") {
      if (p.name === ease.name) return preset.id;
    } else {
      return preset.id;
    }
  }
  return "custom";
}
