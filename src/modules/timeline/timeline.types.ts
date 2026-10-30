import type { Micros } from "@/core";
import type { ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import type { Cut, JunctionKindDefinition } from "@/modules/junction";
import type { LibraryItem } from "@/modules/media";
import type { LucideIcon } from "lucide-react";
import type { MenuItem } from "@/ui";
import type {
  Clip,
  CompositionId,
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
  /** What a drag from another panel would put on a cut, while it hovers one. */
  cutPreview: CutPreview | null;
}

/** A junction not placed yet, shown on the cut it would land on. */
export interface CutPreview {
  cut: Cut;
  /** Name shown on the tag. */
  label: string;
  icon?: LucideIcon;
  /** Overlap it would have (microseconds). */
  duration: Micros;
  /** False when the cut can't take it; dropping would be refused. */
  fits: boolean;
  /** How far each clip would move (microseconds); the lanes show them there meanwhile. */
  shifts: Record<ClipId, Micros>;
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

/** A box on screen, in pixels from the window's top left. */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Something drawn over the lanes, such as a collaborator's playhead. It sits in the scrolling
 * content, outside the virtualized pages: `left` is `HEADER_WIDTH + timeToPx(time)`.
 */
export interface TimelineOverlay {
  /** Unique id, `<module>.<name>`. */
  id: string;
  component: ComponentType;
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
  /** The cut under a screen point (within `CUT_SNAP_PX`), for drops from other panels. */
  cutTarget(clientX: number, clientY: number): Cut | null;
  /**
   * Shows where a dragged junction would land, or clears it (null). Call it when the hovered cut
   * changes, not on every pointer move.
   */
  previewCut(preview: CutPreview | null): void;
  /** The clip's box on screen, or null when no lane shows it. It may be outside the panel. */
  clipBox(id: ClipId): ScreenBox | null;
  /** The visible timeline on screen, or null when it isn't shown. */
  panelBox(): ScreenBox | null;
  /** Calls `listener` when the timeline scrolls. Returns the unsubscribe. */
  onScroll(listener: () => void): () => void;
  /** Brings a time into view. */
  scrollToTime(time: Micros): void;
  /** Registers the scrolling element. For the timeline panel. Returns the detach. */
  attachScroller(element: HTMLElement): () => void;
  /** Keeps `from`'s zoom and scroll, restores `to`'s, and clears the selection. */
  switchComposition(from: CompositionId | null, to: CompositionId | null): void;
  /** Puts something on the timeline: the handlers first, then the usual placement. */
  drop(drop: TimelineDrop): void;
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

/** A strip between the toolbar and the ruler. */
export interface TimelineTabs {
  id: string;
  component: ComponentType;
}

/** Entries a module adds to the timeline's right-click menu. */
export interface TimelineMenuItems {
  id: string;
  /** Asked when the menu opens. */
  items(): MenuItem[];
}

/** Something landing on the timeline. A tile's click is a drop without a place. */
export interface TimelineDrop {
  item:
    | LibraryItem
    | { type: "element"; kind: string; props: Record<string, unknown> }
    | { type: "action"; label: string; place(at: { start?: Micros; trackId?: TrackId }): void };
  start?: Micros;
  trackId?: TrackId;
}

/** Takes a drop before the timeline does. */
export interface TimelineDropHandler {
  id: string;
  /** True when it took care of the drop. */
  handle(drop: TimelineDrop): boolean;
}

/** What a module does with a clip. */
export interface ClipActions {
  id: string;
  /** A double click. True when it took care of it. */
  doubleClick?(clip: Clip): boolean;
  /** Entries of the clip's right-click menu. */
  items?(clip: Clip): MenuItem[];
}
