import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import { createStore } from "zustand/vanilla";
import type { PatchableStore, StoreChange } from "./store.types";

enablePatches();

/**
 * Internal handle with the write operations. Only the command bus and history hold it; the
 * public {@link PatchableStore} type is read-only so nothing can bypass commands.
 */
export interface PatchableStoreInternal<T extends object> extends PatchableStore<T> {
  /** Applies `recipe` to a draft, commits the result and returns the recorded change. */
  produce(recipe: (draft: Draft<T>) => void): StoreChange | null;
  /** Applies previously recorded patches (used by undo/redo and rollback). */
  apply(patches: Patch[]): void;
  /** Replaces the whole state. Only for tests and future project loading. */
  reset(state: T): void;
}

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
