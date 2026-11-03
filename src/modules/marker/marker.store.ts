import { createStore } from "zustand/vanilla";
import type { MarkerUiState } from "./marker.types";

/** The marker view state of one kernel: blue first, no editor open. */
export function createMarkerUi() {
  return createStore<MarkerUiState>(() => ({ lastColor: "blue", editing: null }));
}
