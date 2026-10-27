import type { Point, PointEntry, PointOptions, PointRegistry } from "./points.types";

/** Defines an extension point. Export it from the module that reads it. */
export function definePoint<T>(id: string, options: PointOptions<T> = {}): Point<T> {
  return { id, ...options };
}

/** Creates the point registry of one kernel. */
export function createPointRegistry(): PointRegistry {
  const entries = new Map<string, PointEntry[]>();
  const snapshots = new Map<string, readonly unknown[]>();
  const listeners = new Set<() => void>();

  function changed(pointId: string): void {
    snapshots.delete(pointId);
    for (const listener of listeners) listener();
  }

  function entriesOf(pointId: string): PointEntry[] {
    let list = entries.get(pointId);
    if (!list) entries.set(pointId, (list = []));
    return list;
  }

  return {
    add(point, moduleId, items) {
      const list = entriesOf(point.id);
      if (point.keyOf) {
        const keyOf = point.keyOf;
        const seen = new Set<string>();
        for (const item of items) {
          const key = keyOf(item);
          const existing = list.find((entry) => keyOf(entry.item as never) === key);
          if (existing || seen.has(key)) {
            const owner = existing?.moduleId ?? moduleId;
            throw new Error(
              `Point "${point.id}": key "${key}" from "${moduleId}" is already contributed by "${owner}"`,
            );
          }
          seen.add(key);
        }
      }
      const added: PointEntry[] = items.map((item) => ({ moduleId, item }));
      list.push(...added);
      changed(point.id);

      return () => {
        const current = entries.get(point.id);
        if (!current) return;
        const kept = current.filter((entry) => !added.includes(entry));
        if (kept.length === current.length) return;
        entries.set(point.id, kept);
        changed(point.id);
      };
    },
    get<T>(point: Point<T>): readonly T[] {
      let snapshot = snapshots.get(point.id);
      if (!snapshot) {
        snapshot = (entries.get(point.id) ?? []).map((entry) => entry.item);
        snapshots.set(point.id, snapshot);
      }
      return snapshot as readonly T[];
    },
    find<T>(point: Point<T>, key: string): T | undefined {
      const keyOf = point.keyOf;
      if (!keyOf) throw new Error(`Point "${point.id}" is not keyed`);
      return (entries.get(point.id) ?? []).find((entry) => keyOf(entry.item as T) === key)?.item as
        T | undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
