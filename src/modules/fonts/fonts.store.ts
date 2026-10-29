import { createStore, type StoreApi } from "zustand/vanilla";
import type { FontStatus } from "./fonts.types";

/** Face statuses by `fontKey`. */
export interface FontStatusState {
  statuses: Record<string, FontStatus>;
}

/** Creates the font load statuses of one kernel. Ephemeral: not part of the undo history. */
export function createFontsState(): StoreApi<FontStatusState> {
  return createStore<FontStatusState>()(() => ({ statuses: {} }));
}
