import type { PropertyControl } from "@/modules/inspector";
import { TransitionOptionsControl } from "./TransitionOptionsControl";
import { TransitionPresetControl } from "./TransitionPresetControl";

/** The inspector controls a transition's panel needs: the preset picker and the preset's options. */
export const transitionControls: PropertyControl[] = [
  { id: "transition-preset", for: "field", component: TransitionPresetControl },
  { id: "transition-options", for: "field", component: TransitionOptionsControl },
];
