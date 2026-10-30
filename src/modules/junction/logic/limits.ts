import type { Micros } from "@/core";
import { formatOf, type Clip, type ProjectState } from "@/modules/project";
import type { DurationLimits, JunctionKindDefinition } from "../junction.types";

/** Limits for a kind between two clips; `{0,0,0}` when the kind doesn't overlap. max ≥ min or the cut can't take it. */
export function durationLimits(
  kind: JunctionKindDefinition,
  state: ProjectState,
  left: Clip,
  right: Clip,
): DurationLimits {
  const rule = kind.overlap;
  if (!rule) return { min: 0, max: 0, default: 0 };
  const min = rule.min(formatOf(state, left));
  const max = rule.max(left, right);
  return { min, max, default: Math.min(max, Math.max(min, rule.default)) };
}

/** `d` clamped into the limits (for drags). */
export function clampDuration(d: Micros, limits: DurationLimits): Micros {
  return Math.min(limits.max, Math.max(limits.min, d));
}
