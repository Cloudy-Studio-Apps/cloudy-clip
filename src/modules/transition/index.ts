/**
 * Transition module: the `transition` junction kind and its presets (looks), applied to the cut
 * between two clips from the Transitions tab or by agents.
 * @module transition
 */
/** Point: transition presets. */
export { defineTransitionPreset, transitionPresets } from "./transition.points";
/** Puts a transition preset on a cut, or changes the one there. */
export { applyTransition } from "./transition.commands";
export type {
  TransitionApi,
  TransitionPresetDefinition,
  TransitionProps,
} from "./transition.types";

/** Module definition, loaded by the app shell. */
export { transitionModule } from "./transition.module";
/** Handle for `require(transitionRef)` / `useModule(transitionRef)`. */
export { transitionRef } from "./transition.ref";
