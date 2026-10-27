import type { Micros } from "@/core";
import type { StoreApi } from "zustand/vanilla";
import type { ClipId } from "@/modules/project";

/** Ephemeral view state of the timeline. Not part of the undo history. */
export interface TimelineViewState {
  /** Zoom level. */
  pxPerSecond: number;
  /** Selected clips. */
  selection: ClipId[];
}

/** Which edge of a clip a trim moves. */
export type TrimEdge = "start" | "end";

/** The timeline module's API for one kernel: its view state (zoom, selection). */
export interface TimelineApi {
  /** Zoom and selection. Read with `useStore(api.view, selector)`. */
  readonly view: StoreApi<TimelineViewState>;
  /** Sets the zoom, clamped to 2..400 px per second. */
  setZoom(pxPerSecond: number): void;
  /**
   * Replaces the selection, toggles one clip in it when `additive` is set, or clears it (null).
   * Selecting a clip selects its linked partners; additive toggles the group.
   */
  selectClip(id: ClipId | null, additive?: boolean): void;
}

/** What a drag on a clip does: move it, or trim one of its edges. */
export type ClipGestureMode = "move" | "trim-start" | "trim-end";

/** Limits that apply when trimming a clip. */
export interface TrimLimits {
  /** Length of the source media; `Infinity` if unknown. */
  mediaDuration: Micros;
  minDuration: Micros;
  prevEnd: Micros;
  nextStart: Micros;
}
