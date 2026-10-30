import type { ActorId, CommandOrigin } from "../command/command.types";
import type { StoreChange } from "../store/store.types";

/** One undoable step: everything a single top-level command changed. */
export interface HistoryEntry {
  /** Increasing id, unique per session. */
  id: number;
  commandId: string;
  label: string;
  origin: CommandOrigin;
  actor: ActorId;
  timestamp: number;
  /** Changes in the order they were applied. */
  changes: StoreChange[];
}

/** A step in the log. `seq` orders everything that happens; a redone step gets a new one. */
export interface LogEntry extends HistoryEntry {
  seq: number;
}

/** A step someone undid, waiting for their redo. */
export interface UndoneEntry extends HistoryEntry {
  /** When it was undone. */
  undoneSeq: number;
  /** Whether its inverse patches reverted it, so its patches can reapply it. */
  byPatches: boolean;
}

/** Read-only view of the history, safe to render. */
export interface HistorySnapshot {
  canUndo: boolean;
  canRedo: boolean;
  /** Label of the step `undo` would revert. */
  undoLabel: string | null;
  /** Label of the step `redo` would reapply. */
  redoLabel: string | null;
  /** Every step, whoever made it. Most recent last. */
  past: ReadonlyArray<
    Pick<HistoryEntry, "id" | "commandId" | "label" | "origin" | "actor" | "timestamp">
  >;
}

/**
 * The undo/redo log. User, agent, and plugin changes all live in it, and each actor undoes their
 * own: a step can be reverted past newer steps of others unless one of them touched the same
 * thing, or the result wouldn't be a valid document.
 */
export interface History {
  /** Records a step and clears its actor's redo steps. */
  push(entry: Omit<HistoryEntry, "id" | "timestamp">): void;
  /**
   * Reverts `actor`'s latest step. With no actor: the local actor's once `scopeUndo` was called,
   * else the latest step of all. Returns the reverted entry, or null if there was none. Throws
   * `CommandFailure("history.conflict")`, changing nothing, when the step can't be reverted.
   */
  undo(actor?: ActorId): HistoryEntry | null;
  /** Reapplies a step `undo` reverted. Same `actor` rules, and same failure. */
  redo(actor?: ActorId): HistoryEntry | null;
  /** The label `undo(actor)` would revert. */
  undoLabelOf(actor: ActorId): string | null;
  /** From here on, `undo()` and the snapshot's labels mean the local actor's steps. */
  scopeUndo(): void;
  /** Hands `from`'s remaining steps to `to` and drops `from`'s redo steps. */
  reassign(from: ActorId, to: ActorId): void;
  /** How refusals and toasts name an actor. */
  nameActors(name: (actor: ActorId) => string): void;
  /** An actor's name, as `nameActors` says. */
  nameOf(actor: ActorId): string;
  /** Drops all steps. */
  clear(): void;
  getSnapshot(): HistorySnapshot;
  /** Subscribes to changes. Compatible with React's `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
}
