import type { Micros } from "@/core";
import type { StoreApi } from "zustand/vanilla";
import type { Cut, JunctionKindDefinition } from "@/modules/junction";
import type { LucideIcon } from "lucide-react";
import type {
  ClipId,
  ClipMove,
  Junction,
  JunctionId,
  ProjectState,
  TrackId,
} from "@/modules/project";

/** Ephemeral view state of the timeline. Not part of the undo history. */
export interface TimelineViewState {
  /** Zoom level. */
  pxPerSecond: number;
  /** Selected clips. */
  selection: ClipId[];
  /** Selected junctions (a clip selection and a junction selection never coexist). */
  junctionSelection: JunctionId[];
}

/** Which edge of a clip a trim moves. */
export type TrimEdge = "start" | "end";

/** Where something dropped on the timeline lands: a track and a time. */
export interface DropTarget {
  trackId: TrackId;
  time: Micros;
}

/** A lane's position on screen, for finding drop targets. */
export interface LaneBox {
  trackId: TrackId;
  /** Screen x of time 0 on the lane. */
  left: number;
  top: number;
  bottom: number;
}

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
  /**
   * The track and time under a screen point (for drops from other panels, like a text dragged
   * from the Text tab), or null when the point isn't over a lane.
   */
  dropTarget(clientX: number, clientY: number): DropTarget | null;
  /** Selects a junction (clearing the clip selection), or clears the junction selection (null). */
  selectJunction(id: JunctionId | null): void;
  /** The cut under a screen point (within 8 px), for drops from other panels. */
  cutTarget(clientX: number, clientY: number): Cut | null;
}

/** A junction chip as the lane draws it. */
export interface JunctionChipInfo {
  junction: Junction;
  /** Cut time the chip is centered on (microseconds). */
  center: Micros;
  /** End of the left clip, where the overlap ends. */
  leftEnd: Micros;
  label: string;
  icon: LucideIcon;
  /** The junction's kind isn't registered. */
  missing: boolean;
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
  /** The clip has no source file (text): it can grow both ways and `sourceIn` stays put. */
  sourceless?: boolean;
}

/** A junction kind's declaration, or undefined when no loaded module registers it. */
export type JunctionKindOf = (kind: string) => JunctionKindDefinition | undefined;

/** A project state worked out by a clip command, and the junctions the edit removed. */
export interface JunctionEdit {
  state: ProjectState;
  removed: JunctionId[];
}

/** A clip moved to a start time on a track (its own or another of the same kind). */
export interface ClipTrackMove extends ClipMove {
  trackId: TrackId;
}
