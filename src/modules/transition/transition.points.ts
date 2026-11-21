import { definePoint } from "@/core";
import type { TransitionPresetDefinition } from "./transition.types";

/** Every transition preset (built-in and a plugin's). Keyed by `id`. */
export const transitionPresets = definePoint<TransitionPresetDefinition>("transition.presets", {
  keyOf: (p) => p.id,
});

/** Declares a transition preset; contribute it to `transitionPresets`. */
export function defineTransitionPreset(
  def: TransitionPresetDefinition,
): TransitionPresetDefinition {
  return def;
}

/**
 * A preset that is another with different option defaults (a direction, a color): same look,
 * its own tile, and the chip shows the base's family.
 */
export function variantOf(
  base: TransitionPresetDefinition,
  id: string,
  name: string,
  overrides: Record<string, unknown>,
): TransitionPresetDefinition {
  return {
    ...base,
    id,
    name,
    family: base.family ?? base.name,
    defaults: (format) => ({ ...base.defaults(format), ...overrides }),
  };
}
