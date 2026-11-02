import { createStore } from "zustand/vanilla";
import type { InspectorView, InspectorViewState } from "./inspector.types";

/** Creates the panel's view state of one kernel. Lasts as long as the app runs. */
export function createInspectorView(): InspectorView {
  const store = createStore<InspectorViewState>()(() => ({ tabs: {}, folded: [] }));
  return {
    store,
    setTab(kind, tabId) {
      store.setState((s) => ({ tabs: { ...s.tabs, [kind]: tabId } }));
    },
    toggleFold(key) {
      store.setState((s) => ({
        folded: s.folded.includes(key) ? s.folded.filter((k) => k !== key) : [...s.folded, key],
      }));
    },
  };
}
