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
