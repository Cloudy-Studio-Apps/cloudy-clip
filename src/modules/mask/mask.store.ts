import { createStore } from "zustand/vanilla";
import type { MaskUiState } from "./mask.types";

/** The mask view state of one kernel: nothing selected, not drawing. */
export function createMaskUi() {
  return createStore<MaskUiState>(() => ({
    selectedMaskId: null,
    selectedPointId: null,
    drawing: null,
  }));
}
