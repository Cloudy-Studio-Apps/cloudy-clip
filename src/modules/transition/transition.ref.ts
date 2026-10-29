import { defineModuleRef } from "@/core";
import type { TransitionApi } from "./transition.types";

/** Handle of the transition module: pass it to `require` / `useModule`. */
export const transitionRef = defineModuleRef<TransitionApi>("transition");
