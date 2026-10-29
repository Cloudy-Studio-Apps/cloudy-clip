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
