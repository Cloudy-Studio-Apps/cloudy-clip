import { createStore } from "zustand/vanilla";
import type { PathUiState } from "./path.types";

/** The path view state of one kernel: nothing selected, not drawing. */
export function createPathUi() {
  return createStore<PathUiState>(() => ({
    selectedPathId: null,
    selectedPoint: null,
    drawing: null,
  }));
}
