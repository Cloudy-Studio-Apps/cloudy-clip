import { applyTransition } from "./transition.apply.command";

export { applyTransition };

/** Every command the transition module registers. */
export const transitionCommands = [applyTransition];
