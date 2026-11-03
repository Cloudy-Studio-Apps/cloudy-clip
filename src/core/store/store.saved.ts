import type { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";

function load<T>(key: string, schema: z.ZodType<T>, defaults: T): T {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return schema.parse(raw);
  } catch {
    return defaults;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the value then lives for this session only.
  }
}

/**
 * A store of the user's own choices, kept outside the project: read from `localStorage` under
 * `key` (the defaults when it's missing or doesn't match `schema`) and saved there on each change.
 * Not patchable and never in history. Create one per kernel, in a module's `setup`.
 */
export function createSavedStore<T>(key: string, schema: z.ZodType<T>, defaults: T): StoreApi<T> {
  const store = createStore<T>()(() => load(key, schema, defaults));
  store.subscribe((value) => save(key, value));
  return store;
}
