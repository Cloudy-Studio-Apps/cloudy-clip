import { createStore } from "zustand/vanilla";
import type { CompositionApi, CompositionUiState } from "./composition.types";

type CompositionUi = Omit<CompositionApi, "cancelWaiting" | "landPending">;

/** The composition UI of one kernel: which dialog is open, which tile is selected. */
export function createCompositionUi(): CompositionUi {
  const ui = createStore<CompositionUiState>()(() => ({
    dialog: null,
    selected: null,
    waiting: null,
    pendingDrop: null,
  }));
  return {
    ui,
    openNew: () => ui.setState({ dialog: { mode: "new" } }),
    openSettings: (compositionId) => ui.setState({ dialog: { mode: "settings", compositionId } }),
    closeDialog: () => ui.setState({ dialog: null, pendingDrop: null }),
    select: (selected) => ui.setState({ selected }),
  };
}
