import { createStore } from "zustand/vanilla";
import { CommandFailure, LOCAL_ACTOR, type PatchableStore } from "@/core";
import { DEFAULT_FORMAT } from "./project.store";
import type { CompositionView, CompositionViewState, ProjectState } from "./project.types";

/**
 * Who has which composition open. Tied to the document: an actor whose composition is gone falls
 * back to Main, then to none, and a tab of it closes.
 */
export function createCompositionView(document: PatchableStore<ProjectState>): CompositionView {
  const store = createStore<CompositionViewState>(() => ({ open: {}, tabs: [] }));

  const openFor: CompositionView["openFor"] = (actor) => {
    const open = store.getState().open[actor];
    return open === undefined ? document.getState().mainCompositionId : open;
  };

  /** Drops what no longer exists, and gives the user's open composition its tab. */
  const sync = () => {
    const { compositions } = document.getState();
    const state = store.getState();
    const open = Object.fromEntries(
      Object.entries(state.open).filter(([, id]) => id === null || compositions[id]),
    );
    const tabs = state.tabs.filter((id) => compositions[id]);
    store.setState({ open, tabs });
    const current = openFor(LOCAL_ACTOR);
    if (current !== null && !tabs.includes(current)) store.setState({ tabs: [...tabs, current] });
  };

  const stop = document.subscribe(sync);
  sync();

  return {
    store,
    openFor,
    setOpen(actor, id) {
      store.setState((state) => ({ open: { ...state.open, [actor]: id } }));
      sync();
    },
    closeTab(id) {
      const { tabs } = store.getState();
      const index = tabs.indexOf(id);
      if (index < 0) return;
      const rest = tabs.filter((tab) => tab !== id);
      store.setState({ tabs: rest });
      if (openFor(LOCAL_ACTOR) !== id) return;
      const next = rest[index] ?? rest[index - 1] ?? null;
      store.setState((state) => ({ open: { ...state.open, [LOCAL_ACTOR]: next } }));
    },
    requireOpen(actor) {
      const id = openFor(actor);
      const composition = id === null ? undefined : document.getState().compositions[id];
      if (!composition) {
        throw new CommandFailure(
          "composition.none_open",
          "No composition is open. Create one first: composition_create, or composition_create_from_media.",
        );
      }
      return composition;
    },
    formatFor(actor) {
      const id = openFor(actor);
      return (id !== null && document.getState().compositions[id]?.format) || DEFAULT_FORMAT;
    },
    dispose: stop,
  };
}
