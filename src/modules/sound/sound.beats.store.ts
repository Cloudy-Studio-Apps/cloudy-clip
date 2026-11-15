import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand";
import type { BeatsState } from "./sound.types";

/** Creates the beats found in one kernel: none yet. View state, never in history. */
export function createBeatsStore(): StoreApi<BeatsState> {
  return createStore<BeatsState>()(() => ({ files: {}, running: null, failed: null }));
}
