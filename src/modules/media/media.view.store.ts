import { createStore } from "zustand/vanilla";
import type { LibraryView } from "./media.types";

/** What's open in the library. Per kernel, and never in history. */
export function createLibraryView() {
  return createStore<LibraryView>(() => ({
    place: { kind: "bin", binId: null },
    search: "",
    layout: "grid",
    selection: [],
    autoNext: false,
  }));
}
