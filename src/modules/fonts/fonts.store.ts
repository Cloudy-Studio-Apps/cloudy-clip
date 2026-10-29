import { createStore, type StoreApi } from "zustand/vanilla";
import type { FontStatusState } from "./fonts.types";

/** Creates the font load statuses of one kernel. Ephemeral: not part of the undo history. */
export function createFontsState(): StoreApi<FontStatusState> {
  return createStore<FontStatusState>()(() => ({ statuses: {} }));
}
