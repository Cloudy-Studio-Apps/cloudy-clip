import type { StoreApi } from "zustand/vanilla";
import type { Micros } from "@/core";
import type {
  Clip,
  ClipId,
  CompositionId,
  JunctionId,
  ProjectFormat,
  TrackId,
} from "@/modules/project";
import type { TimelineDrop } from "@/modules/timeline";

/** Named formats offered in the dialog. */
export type CompositionPresetId = "9:16" | "16:9" | "1:1" | "4:5" | "4k-16:9" | "4k-9:16";

/** A format offered in the dialog. */
export interface CompositionPreset {
  id: CompositionPresetId;
  label: string;
  hint: string;
  format: ProjectFormat;
}

/** What grouping clips means, or the clip in the way. */
export type GroupPlan =
  | {
      homeId: CompositionId;
      span: { start: Micros; end: Micros };
      videoTrack: TrackId | null;
      audioTrack: TrackId | null;
      clips: ClipId[];
      droppedJunctions: JunctionId[];
    }
  | { blocked: Clip };

/** Which composition dialog is open. */
export type CompositionDialogState =
  { mode: "new" } | { mode: "settings"; compositionId: CompositionId };

/** The composition UI. View state, never in history. */
export interface CompositionUiState {
  dialog: CompositionDialogState | null;
  /** The tile selected in the Library. */
  selected: CompositionId | null;
  /** The dropped file being read, by name. */
  waiting: string | null;
  /** What lands once the dialog is confirmed. */
  pendingDrop: TimelineDrop | null;
}

/** The composition module's API for one kernel. */
export interface CompositionApi {
  ui: StoreApi<CompositionUiState>;
  /** Opens the New Composition dialog. */
  openNew(): void;
  /** Opens Composition Settings. */
  openSettings(compositionId: CompositionId): void;
  closeDialog(): void;
  /** Selects a tile in the Library. */
  select(compositionId: CompositionId | null): void;
  /** Drops the file being waited for. */
  cancelWaiting(): void;
  /** Lands what the dialog was opened for, now that a composition exists. */
  landPending(): void;
}
