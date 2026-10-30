import { createStore } from "zustand/vanilla";
import type { CompositionApi, CompositionUiState } from "./composition.types";

/** The composition UI of one kernel: which dialog is open, which tile is selected. */
export function createCompositionUi(): CompositionApi {
  const ui = createStore<CompositionUiState>()(() => ({ dialog: null, selected: null }));
  return {
    ui,
    openNew: () => ui.setState({ dialog: { mode: "new" } }),
    openSettings: (compositionId) => ui.setState({ dialog: { mode: "settings", compositionId } }),
    closeDialog: () => ui.setState({ dialog: null }),
    select: (selected) => ui.setState({ selected }),
  };
}
