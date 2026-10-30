import { LOCAL_ACTOR } from "../command/command.actor";
import type { ActorId } from "../command/command.types";
import { CommandFailure } from "../errors/result";
import { asInternal } from "../store/store.patchable";
import type { FieldChange } from "../store/store.types";
import type {
  History,
  HistoryEntry,
  HistorySnapshot,
  LogEntry,
  UndoneEntry,
} from "./history.types";

/** Default number of steps kept. Older steps are dropped to bound memory. */
const DEFAULT_LIMIT = 500;

/** Whether two field paths touch the same thing: equal, or one holds the other. */
function overlaps(a: readonly string[], b: readonly string[]): boolean {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function fieldsOf(entry: HistoryEntry): FieldChange[] {
  return entry.changes.flatMap((change) => change.fields ?? []);
}

/** Creates the patch-based undo/redo log. */
export function createHistory(limit = DEFAULT_LIMIT): History {
  let log: LogEntry[] = [];
  const futures = new Map<ActorId, UndoneEntry[]>();
  let nextId = 1;
  let seq = 0;
  /**
   * The last out-of-order write. Steps before it were recorded over arrays that have changed
   * shape since, so their index-based patches no longer apply.
   */
  let reshapedAt = 0;
  /** Steps undone by patches with nothing since but undos: only these can redo by patches. */
  let rewound: number[] = [];
  let scoped = false;
  let nameOf: (actor: ActorId) => string = () => "Someone";
  let snapshot: HistorySnapshot = buildSnapshot();
  const listeners = new Set<() => void>();

  function latestOf(actor: ActorId | undefined): LogEntry | undefined {
    return actor === undefined ? log.at(-1) : log.filter((e) => e.actor === actor).at(-1);
  }

  /** The actor a call without one means. */
  function resolve(actor: ActorId | undefined): ActorId | undefined {
    return actor ?? (scoped ? LOCAL_ACTOR : undefined);
  }

  /** The next step to redo: the actor's, or the latest undone of all. */
  function nextRedo(actor: ActorId | undefined): UndoneEntry | undefined {
    if (actor !== undefined) return futures.get(actor)?.at(-1);
    let latest: UndoneEntry | undefined;
    for (const future of futures.values()) {
      const entry = future.at(-1);
      if (entry && (!latest || entry.undoneSeq > latest.undoneSeq)) latest = entry;
    }
    return latest;
  }

  function buildSnapshot(): HistorySnapshot {
    const actor = resolve(undefined);
    const undoable = latestOf(actor);
    const redoable = nextRedo(actor);
    return {
      canUndo: undoable !== undefined,
      canRedo: redoable !== undefined,
      undoLabel: undoable?.label ?? null,
      redoLabel: redoable?.label ?? null,
      past: log.map(({ id, commandId, label, origin, actor, timestamp }) => ({
        id,
        commandId,
        label,
        origin,
        actor,
        timestamp,
      })),
    };
  }

  function changed(): void {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  /** Fails if a step after `since` by someone else touched what `entry` changed. */
  function refuseClashes(entry: HistoryEntry, since: number, verb: string): void {
    const fields = fieldsOf(entry);
    for (const later of log) {
      if (later.seq <= since || later.actor === entry.actor) continue;
      const clash = fieldsOf(later).some((other) =>
        fields.some((field) => overlaps(field.path, other.path)),
      );
      if (clash) {
        throw new CommandFailure(
          "history.conflict",
          `Can't ${verb}: ${nameOf(later.actor)} changed this afterwards ("${later.label}")`,
        );
      }
    }
  }

  /** Writes a step's `before` or `after` values, whatever else changed around them. */
  function writeFields(entry: HistoryEntry, side: "before" | "after", verb: string): void {
    const changes = side === "before" ? [...entry.changes].reverse() : entry.changes;
    if (changes.some((change) => !asInternal(change.store).hasPolicy)) {
      throw new CommandFailure("history.conflict", `Can't ${verb}: later steps depend on this one`);
    }
    for (const change of changes) {
      const fields = side === "before" ? [...(change.fields ?? [])].reverse() : change.fields;
      const writes = (fields ?? []).map((field) => ({ path: field.path, value: field[side] }));
      const problem = asInternal(change.store).writeFields(writes);
      if (problem !== null) {
        throw new CommandFailure("history.conflict", `Can't ${verb}: ${problem}`);
      }
    }
    reshapedAt = ++seq;
    rewound = [];
  }

  return {
    push(entry) {
      log.push({ ...entry, id: nextId++, timestamp: Date.now(), seq: ++seq });
      if (log.length > limit) log = log.slice(log.length - limit);
      futures.delete(entry.actor);
      rewound = [];
      changed();
    },
    undo(actor) {
      const entry = latestOf(resolve(actor));
      if (!entry) return null;
      const byPatches = entry === log.at(-1) && entry.seq > reshapedAt;
      if (byPatches) {
        for (let i = entry.changes.length - 1; i >= 0; i--) {
          const change = entry.changes[i]!;
          asInternal(change.store).apply(change.inversePatches);
        }
      } else {
        refuseClashes(entry, entry.seq, "undo");
        writeFields(entry, "before", "undo");
      }
      log = log.filter((step) => step !== entry);
      const undone: UndoneEntry = { ...entry, undoneSeq: ++seq, byPatches };
      futures.set(entry.actor, [...(futures.get(entry.actor) ?? []), undone]);
      if (byPatches) rewound.push(undone.undoneSeq);
      changed();
      return entry;
    },
    redo(actor) {
      const entry = nextRedo(resolve(actor));
      if (!entry) return null;
      if (entry.byPatches && rewound.at(-1) === entry.undoneSeq) {
        for (const change of entry.changes) asInternal(change.store).apply(change.patches);
        rewound.pop();
      } else {
        refuseClashes(entry, entry.undoneSeq, "redo");
        writeFields(entry, "after", "redo");
      }
      futures.get(entry.actor)?.pop();
      log.push({ ...entry, seq: ++seq });
      changed();
      return entry;
    },
    undoLabelOf: (actor) => latestOf(actor)?.label ?? null,
    scopeUndo() {
      scoped = true;
      changed();
    },
    reassign(from, to) {
      log = log.map((entry) => (entry.actor === from ? { ...entry, actor: to } : entry));
      futures.delete(from);
      changed();
    },
    nameActors(name) {
      nameOf = name;
    },
    clear() {
      log = [];
      futures.clear();
      rewound = [];
      changed();
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
