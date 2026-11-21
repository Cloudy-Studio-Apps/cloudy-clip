import type { StoreApi } from "zustand/vanilla";
import type {
  ClipMask,
  MaskId,
  MaskMapping,
  MaskMode,
  PointId,
  ProjectFormat,
  Vec2,
} from "@/modules/project";

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

/** A number a mask has, as the tab's slider edits it. */
export interface MaskFieldSpec {
  /** The name in `mask.update`'s patch (inside `shape` when `shape` is set). */
  name: string;
  shape?: true;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Shown value = stored value times this (percent for 0–1 numbers). */
  show?: number;
}

/** One row of the selected mask's fields: a label and one or two numbers sharing a diamond. */
export interface MaskRowSpec {
  label: string;
  fields: MaskFieldSpec[];
}

/** Where a mask's own shape sits in mask space: its center (`x`, `y`) and its turn in degrees. */
export interface MaskPlace {
  x: number;
  y: number;
  rotation: number;
}

/**
 * What a handle of the selected mask drags: the whole mask, a corner or side of a preset's box,
 * its rotation, feather, a rectangle's roundness, a star's inner radius or a mirror's width.
 */
export type MaskHandleKind =
  "move" | "corner" | "side" | "rotate" | "feather" | "roundness" | "inner" | "width";

/** A handle of the selected mask on the canvas: where it sits (mask space) and which way it pulls. */
export interface MaskHandle {
  id: string;
  kind: MaskHandleKind;
  /** The side of the box it sits on, in the mask's own axes (-1, 0 or 1). */
  dx: number;
  dy: number;
  at: Vec2;
}

/** What a canvas drag changes on a mask, as `mask.update` takes it in `patch`. */
export interface MaskPatch {
  x?: number;
  y?: number;
  rotation?: number;
  feather?: number;
  shape?: Record<string, number>;
}

/** A drag on a handle of the selected mask (`startMaskDrag`), captured when it starts. */
export interface MaskDragOptions {
  event: PointerEvent;
  /** The overlay, which covers the frame exactly. */
  frame: HTMLElement;
  format: ProjectFormat;
  /** The clip's `frameMapping`. */
  mapping: MaskMapping;
  /** The mask as drawn when the drag starts (its values at the playhead). */
  mask: ClipMask;
  handle: MaskHandle;
  /** Each move past the threshold, with the patch so far. */
  onMove(patch: MaskPatch): void;
  /** Release after a drag. */
  onDrop(patch: MaskPatch): void;
  /** Escape or a cancelled pointer after a drag. */
  onCancel(): void;
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
    "mask.update": {
      clipId: string;
      maskId: string;
      patch: Record<string, unknown>;
      at?: number;
    };
    "mask.remove": { clipId: string; maskIds: string[] };
    "mask.reorder": { clipId: string; maskId: string; index: number };
    "mask.setPoints": {
      clipId: string;
      maskId: string;
      points: Array<MaskPointInput & { id?: PointId }>;
      insertAt?: { after: PointId; t: number };
      at?: number;
    };
    "mask.convert": { clipId: string; maskId: string };
    "mask.setMatte": {
      clipIds: string[];
      trackId: string | null;
      by?: "alpha" | "luma";
      invert?: boolean;
    };
  }
}
