import type { StoreApi } from "zustand/vanilla";
import type { MaskId, MaskMode, PointId } from "@/modules/project";

/** The shapes a mask can be added as. */
export type MaskPreset = "rectangle" | "ellipse" | "star" | "heart" | "linear" | "mirror";

/** What the user is doing with masks right now. View state: never in the document. */
export interface MaskUiState {
  /** The mask shown and edited on the canvas, if any. */
  selectedMaskId: MaskId | null;
  /** The point of a path mask whose handles show, if any. */
  selectedPointId: PointId | null;
  /** Drawing a new path mask: how. Null when not drawing. */
  drawing: null | { mode: "freehand" | "pen" };
}

/** A point of a path mask in mask space; handles are offsets from the point (0 = a corner). */
export interface MaskPointInput {
  x: number;
  y: number;
  inX?: number;
  inY?: number;
  outX?: number;
  outY?: number;
}

/** The numbers of a mask, as `mask.add` takes them and `mask.update` takes them in `patch`. */
export interface MaskNumbers {
  opacity?: number;
  feather?: number;
  expansion?: number;
  x?: number;
  y?: number;
  rotation?: number;
  width?: number;
  height?: number;
  roundness?: number;
  points?: number;
  inner?: number;
}

/** The mask module's API for one kernel. */
export interface MaskApi {
  /** The selected mask and point, and the drawing in progress. Read with `useStore(api.ui, selector)`. */
  readonly ui: StoreApi<MaskUiState>;
}

declare module "@/core" {
  interface CommandInputs {
    "mask.add": {
      clipIds: string[];
      preset?: MaskPreset;
      points?: MaskPointInput[];
      values?: MaskNumbers;
      mode?: MaskMode;
      name?: string;
    };
    "mask.remove": { clipId: string; maskIds: string[] };
    "mask.reorder": { clipId: string; maskId: string; index: number };
    "mask.setMatte": {
      clipIds: string[];
      trackId: string | null;
      by?: "alpha" | "luma";
      invert?: boolean;
    };
  }
}
