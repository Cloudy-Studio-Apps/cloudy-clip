import type { Disposer } from "./module.types";

/** Options of {@link Point}. */
export interface PointOptions<T> {
  /**
   * Makes the point keyed: each item's key must be unique, and items can be looked up by key.
   * A duplicate key is rejected, naming both contributing modules.
   */
  keyOf?: (item: T) => string;
}

/**
 * A typed extension point: a place where modules (and later plugins) contribute items, such as
 * panels or keybindings. Defined next to the code that reads it, with `definePoint`.
 */
export interface Point<T> extends PointOptions<T> {
  /** Unique id, used in error messages. */
  readonly id: string;
  /** Phantom field carrying the item type. Never set. */
  readonly __item?: T;
}

/** Read access to points. Given to modules and the app shell. */
export interface PointReader {
  /**
   * Items contributed to a point, in contribution order. The same array is returned until the
   * point changes, so it is safe as a `useSyncExternalStore` snapshot.
   */
  get<T>(point: Point<T>): readonly T[];
  /** The item with this key, for keyed points. */
  find<T>(point: Point<T>, key: string): T | undefined;
  /** Called after any point changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

/** Holds every contribution of one kernel. */
export interface PointRegistry extends PointReader {
  /** Adds items on behalf of a module. Returns a disposer that removes exactly these items. */
  add<T>(point: Point<T>, moduleId: string, items: readonly T[]): Disposer;
}

/** One contribution, remembered with the module that made it. */
export interface PointEntry {
  moduleId: string;
  item: unknown;
}
