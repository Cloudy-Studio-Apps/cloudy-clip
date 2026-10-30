import { applyPatches, enablePatches, produce, produceWithPatches, type Draft } from "immer";
import { createStore } from "zustand/vanilla";
import type { PatchableStore, PatchableStoreInternal, StorePolicy } from "./store.types";

enablePatches();

/** Sets the value at `path` on a draft, or deletes it when `value` is undefined. */
function writePath(draft: object, path: readonly string[], value: unknown): void {
  let target = draft as Record<string, unknown>;
  for (const key of path.slice(0, -1)) {
    const next = target[key];
    if (typeof next !== "object" || next === null) return; // its parent is gone
    target = next as Record<string, unknown>;
  }
  const last = path.at(-1)!;
  // A copy: the recorded value is frozen, and `repair` may write into it.
  if (value === undefined) delete target[last];
  else target[last] = structuredClone(value);
}

/** Creates a {@link PatchableStore} with the given initial state. */
export function createPatchableStore<T extends object>(
  id: string,
  initial: T,
  policy?: StorePolicy<T>,
): PatchableStoreInternal<T> {
  const api = createStore<T>()(() => initial);

  const store: PatchableStoreInternal<T> = {
    id,
    api,
    getState: () => api.getState(),
    subscribe: (listener) => api.subscribe(listener),
    hasPolicy: policy !== undefined,
    produce(recipe) {
      const previous = api.getState();
      const [next, patches, inversePatches] = produceWithPatches(previous, recipe);
      if (patches.length === 0) return null;
      api.setState(next, true);
      return {
        store: store as PatchableStore<object>,
        patches,
        inversePatches,
        ...(policy ? { fields: policy.diff(previous, next) } : {}),
      };
    },
    writeFields(writes) {
      if (!policy) throw new Error(`Store "${id}" has no policy`);
      const next = produce(api.getState(), (draft: Draft<T>) => {
        for (const { path, value } of writes) writePath(draft, path, value);
        policy.repair(draft);
      });
      const problem = policy.validate(next);
      if (problem === null) api.setState(next, true);
      return problem;
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
