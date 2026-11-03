import type { StoreApi } from "zustand/vanilla";
import type { MarkerColor, MarkerId } from "@/modules/project";

/** What the user is doing with markers right now. View state: never in the document. */
export interface MarkerUiState {
  /** The color a new marker takes: the one picked last. */
  lastColor: MarkerColor;
  /** The marker whose editor is open, if any. */
  editing: MarkerId | null;
}

/** The marker module's API for one kernel. */
export interface MarkerApi {
  /** The last color picked and the open editor. Read with `useStore(api.ui, selector)`. */
  readonly ui: StoreApi<MarkerUiState>;
}
