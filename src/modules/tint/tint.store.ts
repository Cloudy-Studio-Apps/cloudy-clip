import { createStore } from "zustand/vanilla";
import type { TintView } from "./tint.types";

/** The page's view state for one kernel: Baby Seal on Basics, with the demo's Skin layer selected. */
export function createTintView() {
  return createStore<TintView>()(() => ({
    mode: "baby",
    tool: "basics",
    wheels: "primary",
    level: "clip",
    scope: "parade",
    curve: "custom",
    leftTab: "grade",
    selected: "n3",
    family: 1,
    bypass: false,
    compare: false,
    falseColor: false,
    warning: false,
    guides: false,
    samples: false,
    clean: false,
  }));
}
