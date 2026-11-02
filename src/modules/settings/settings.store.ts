import { createStore } from "zustand/vanilla";
import type { SettingsState } from "./settings.types";

/** Creates the window's state of one kernel. */
export function createSettingsState() {
  return createStore<SettingsState>()(() => ({ open: false }));
}
