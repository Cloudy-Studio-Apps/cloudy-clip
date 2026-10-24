import type { Patch } from "immer";
import type { StoreApi } from "zustand/vanilla";

/**
 * A store whose changes are recorded as Immer patches, which makes them undoable.
 *
 * Use it for *document* state: anything that is part of the user's work (media, tracks,
 * clips). Do not use it for ephemeral UI state (selection, zoom, playhead); that belongs in a
 * plain Zustand store so it never pollutes the undo history.
 *
 * Patchable stores are only changed through commands (`ctx.mutate`). Reading is free.
 */
export interface PatchableStore<T extends object> {
  /** Unique id, used in logs and history entries. */
  readonly id: string;
  /** The underlying Zustand store. Pass it to `useStore` to read from React with a selector. */
  readonly api: StoreApi<T>;
  /** Current state snapshot. Frozen: never mutate it. */
  getState(): T;
  /** Subscribes to every change. Returns an unsubscribe function. */
  subscribe(listener: (state: T, previous: T) => void): () => void;
}

/** The patches produced by one `mutate` call on one store. */
export interface StoreChange {
  store: PatchableStore<object>;
  patches: Patch[];
  inversePatches: Patch[];
}
