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

/** Read-only view of the history, safe to render. */
export interface HistorySnapshot {
  canUndo: boolean;
  canRedo: boolean;
  /** Label of the step `undo` would revert. */
  undoLabel: string | null;
  /** Label of the step `redo` would reapply. */
  redoLabel: string | null;
  /** Most recent last. */
  past: ReadonlyArray<
    Pick<HistoryEntry, "id" | "commandId" | "label" | "origin" | "actor" | "timestamp">
  >;
}

/** The shared undo/redo stack. User, agent, and plugin changes all live in it. */
export interface History {
  /** Records a step and clears the redo stack. */
  push(entry: Omit<HistoryEntry, "id" | "timestamp">): void;
  /** Reverts the latest step. Returns the reverted entry, or null if there was none. */
  undo(): HistoryEntry | null;
  /** Reapplies the latest reverted step. */
  redo(): HistoryEntry | null;
  /** Drops all steps. */
  clear(): void;
  getSnapshot(): HistorySnapshot;
  /** Subscribes to changes. Compatible with React's `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
}
