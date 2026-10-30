import type { Draft, Patch } from "immer";
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

/** One field across a change. `undefined` means it was, or became, absent. */
export interface FieldChange {
  path: readonly string[];
  before: unknown;
  after: unknown;
}

/**
 * What lets a store's steps be undone out of order, past other people's later steps. Patches can't
 * do it: they address arrays by index and may replace whole records. So a store with a policy
 * also describes each change field by field, and repairs and validates what such an undo leaves.
 */
export interface StorePolicy<T extends object> {
  /** The fields that differ. An entity created or deleted is one change at its own path. */
  diff(before: T, after: T): FieldChange[];
  /** Rebuilds what is derived from the fields (ordering arrays). */
  repair(draft: Draft<T>): void;
  /** Why the state is invalid, or null. */
  validate(state: T): string | null;
}

/** The patches produced by one `mutate` call on one store. */
export interface StoreChange {
  store: PatchableStore<object>;
  patches: Patch[];
  inversePatches: Patch[];
  /** The change field by field, when the store has a policy. */
  fields?: FieldChange[];
}

/**
 * Internal handle with the write operations. Only the command bus and history hold it; the
 * public {@link PatchableStore} type is read-only so nothing can bypass commands.
 */
export interface PatchableStoreInternal<T extends object> extends PatchableStore<T> {
  /** Applies `recipe` to a draft, commits the result and returns the recorded change. */
  produce(recipe: (draft: Draft<T>) => void): StoreChange | null;
  /** Applies previously recorded patches (used by undo/redo and rollback). */
  apply(patches: Patch[]): void;
  /**
   * Writes values at paths (`undefined` deletes), repairs and validates. Commits, or changes
   * nothing and returns why the result is invalid. Only for stores with a policy.
   */
  writeFields(writes: ReadonlyArray<{ path: readonly string[]; value: unknown }>): string | null;
  /** Whether out-of-order writes are possible. */
  readonly hasPolicy: boolean;
  /** Replaces the whole state. Only for tests and future project loading. */
  reset(state: T): void;
}
