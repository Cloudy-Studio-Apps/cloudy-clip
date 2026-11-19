import type { StoreApi } from "zustand/vanilla";
import type { PathId, PathPoint } from "@/modules/project";
import type { PointPart } from "./logic/edit";

/** How a path is being drawn: freehand (one stroke, fitted into points) or with the pen. */
export type DrawMode = "freehand" | "pen";

/** What the user is doing with paths right now. View state: never in the document. */
export interface PathUiState {
  /** The path shown and edited on the canvas (picked in the Library), if any. */
  selectedPathId: PathId | null;
  /** The index of its point whose handles show, if any. */
  selectedPoint: number | null;
  /** Drawing a new path: how, and the clips that will follow it. Null when not drawing. */
  drawing: null | { mode: DrawMode; attach: string[] };
}

/** The path module's API for one kernel. */
export interface PathApi {
  /** The selected path and point, and the drawing in progress. Read with `useStore(api.ui, selector)`. */
  readonly ui: StoreApi<PathUiState>;
}

declare module "@/core" {
  interface CommandInputs {
    "path.attach": { clipIds: string[]; pathId: string };
    "path.detach": { clipIds: string[]; at?: number };
  }
}

/** What a drag on the path overlay moves and how it reports back. */
export interface PathEditOptions {
  event: PointerEvent;
  /** The overlay, which covers the frame exactly. */
  frame: HTMLElement;
  size: { width: number; height: number };
  points: PathPoint[];
  closed: boolean;
  index: number;
  part: PointPart;
  /** Called on release with the new points, when they moved. */
  onDrop(points: PathPoint[]): void;
}
