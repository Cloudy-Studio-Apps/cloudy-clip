import { asInternal } from "../store/store.patchable";
import type { History, HistoryEntry, HistorySnapshot } from "./history.types";

/** Default number of steps kept. Older steps are dropped to bound memory. */
const DEFAULT_LIMIT = 500;

/** Creates the patch-based undo/redo stack. */
export function createHistory(limit = DEFAULT_LIMIT): History {
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];
  let nextId = 1;
  let snapshot: HistorySnapshot = buildSnapshot();
  const listeners = new Set<() => void>();

  function buildSnapshot(): HistorySnapshot {
    return {
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      undoLabel: past.at(-1)?.label ?? null,
      redoLabel: future.at(-1)?.label ?? null,
      past: past.map(({ id, commandId, label, origin, timestamp }) => ({
        id,
        commandId,
        label,
        origin,
        timestamp,
      })),
    };
  }

  function changed(): void {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  return {
    push(entry) {
      past.push({ ...entry, id: nextId++, timestamp: Date.now() });
      if (past.length > limit) past = past.slice(past.length - limit);
      future = [];
      changed();
    },
    undo() {
      const entry = past.pop();
      if (!entry) return null;
      for (let i = entry.changes.length - 1; i >= 0; i--) {
        const change = entry.changes[i]!;
        asInternal(change.store).apply(change.inversePatches);
      }
      future.push(entry);
      changed();
      return entry;
    },
    redo() {
      const entry = future.pop();
      if (!entry) return null;
      for (const change of entry.changes) asInternal(change.store).apply(change.patches);
      past.push(entry);
      changed();
      return entry;
    },
    clear() {
      past = [];
      future = [];
      changed();
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
