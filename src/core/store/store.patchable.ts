import { applyPatches, enablePatches, produceWithPatches } from "immer";
import { createStore } from "zustand/vanilla";
import type { PatchableStore, PatchableStoreInternal } from "./store.types";

enablePatches();

/** Creates a {@link PatchableStore} with the given initial state. */
export function createPatchableStore<T extends object>(
  id: string,
  initial: T,
): PatchableStoreInternal<T> {
  const api = createStore<T>()(() => initial);

  const store: PatchableStoreInternal<T> = {
    id,
    api,
    getState: () => api.getState(),
    subscribe: (listener) => api.subscribe(listener),
    produce(recipe) {
      const [next, patches, inversePatches] = produceWithPatches(api.getState(), recipe);
      if (patches.length === 0) return null;
      api.setState(next, true);
      return { store: store as PatchableStore<object>, patches, inversePatches };
    },
    apply(patches) {
      api.setState(applyPatches(api.getState(), patches), true);
    },
    reset(state) {
      api.setState(state, true);
    },
  };
  return store;
}

/** Narrows a public store to its internal handle. Kernel-only. */
export function asInternal<T extends object>(store: PatchableStore<T>): PatchableStoreInternal<T> {
  return store as PatchableStoreInternal<T>;
}
