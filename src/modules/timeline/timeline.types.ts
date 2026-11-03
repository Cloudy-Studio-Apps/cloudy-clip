import type { ActorId, Micros, TimelineScopeName } from "@/core";
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
  TrackKind,
} from "@/modules/project";

/** Anything a module adds to the timeline that can name the scopes it shows in. */
export interface Scoped {
  /**
   * The timeline scopes it shows in. Unset means `["all"]`, the editor only, so a new
   * contribution can't reach a picture from a sound-only page by accident.
   */
  scopes?: readonly TimelineScopeName[];
}

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
  /** Width of the track header column, in px. `HEADER_WIDTH` unless a module widened it. */
  headerWidth: number;
  /** The first sound-only edit of a session has said it unlinked a sound from its picture. */
  soundUnlinkTold: boolean;
  /** Only the ruler shows: the tracks are folded away, zoom and scroll stay. */
  tracksHidden: boolean;
  /** Scopes whose panel doesn't snap (the Sound page's Snap off). The editor always snaps. */
  unsnapped: TimelineScopeName[];
}

/** A track a page keeps in focus beside the clip selection (the Sound page's mixer strip). */
export interface TrackFocus {
  /** The track whose header is marked and kept in view, or null. */
  selected: TrackId | null;
  /** Called when a track's header is clicked. */
  select(trackId: TrackId): void;
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
 * content, outside the virtualized pages: `left` is the header width (`useHeaderWidth()`) plus
 * `timeToPx(time)`.
 */
export interface TimelineOverlay extends Scoped {
  /** Unique id, `<module>.<name>`. */
  id: string;
  component: ComponentType;
}

/** Times a module adds to what moves, trims and the ruler scrub snap to (markers). */
export interface TimelineSnapTarget {
  /** Unique id, `<module>.<name>`. */
  id: string;
  /** The times to snap to on a composition's timeline. */
  times(state: ProjectState, compositionId: CompositionId): readonly Micros[];
}

/** Everything a drag snaps to on a composition: clip edges, cuts, the playhead and targets. */
export type SnapCandidates = (
  state: ProjectState,
  compositionId: CompositionId,
  playhead: Micros,
  ignore?: ReadonlySet<ClipId>,
) => Micros[];

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
  /** Draws a clip at a length while a tool drags it, or back at its own (null). */
  previewClipLength(id: ClipId, duration: Micros | null): void;
  /** The clip's box on screen, or null when no lane shows it. It may be outside the panel. */
  clipBox(id: ClipId): ScreenBox | null;
  /** The visible timeline on screen, or null when it isn't shown. */
  panelBox(): ScreenBox | null;
  /** Calls `listener` when the timeline scrolls. Returns the unsubscribe. */
  onScroll(listener: () => void): () => void;
  /** Brings a time into view. */
  scrollToTime(time: Micros): void;
  /**
   * The scope of the active page's timeline (`AppPage.timelineScope`, `"all"` on the editor), for
   * what acts outside a panel (a shortcut) to touch only what that page may.
   */
  activeScope(): TimelineScopeName;
  /**
   * Registers the scrolling element of the panel of a scope (default `"all"`); there is one per
   * scope, and scrolling and zooming act on the active page's. For the timeline panel. Returns
   * the detach.
   */
  attachScroller(element: HTMLElement, scope?: TimelineScopeName): () => void;
  /** Keeps `from`'s zoom and scroll, restores `to`'s, and clears the selection. */
  switchComposition(from: CompositionId | null, to: CompositionId | null): void;
  /** Puts something on the timeline: the handlers first, then the usual placement. */
  drop(drop: TimelineDrop): void;
  /** Sets the header column's width in px; null goes back to `HEADER_WIDTH`. */
  setHeaderWidth(px: number | null): void;
  /** Folds the tracks away, leaving the ruler (true), or shows them again (false). */
  setTracksHidden(hidden: boolean): void;
  /** Turns snapping on or off for the panel of a scope (`view.unsnapped`). */
  setSnap(scope: TimelineScopeName, on: boolean): void;
  /** How far the timeline is scrolled sideways, in px (0 when it isn't shown). */
  scrollLeft(): number;
  /** Scrolls the timeline sideways to a position in px. */
  setScrollLeft(px: number): void;
  /**
   * Zooms to `pxPerSecond` (clamped like `setZoom`) keeping the time under a screen x where it is.
   */
  zoomAt(clientX: number, pxPerSecond: number): void;
  /** What each actor copied. */
  readonly clipboard: TimelineClipboard;
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

/** What an actor copied. Copies, so later edits of the originals don't change them. */
export interface ClipboardEntry {
  /** The clips and their partners. */
  clips: readonly Clip[];
  /** Earliest start among them. */
  origin: Micros;
  /** The kind of the tracks they came from, which may be gone by the paste. */
  trackKinds: Readonly<Record<TrackId, TrackKind>>;
}

/** Per actor, so an agent's copy doesn't replace the user's. Never in history. */
export interface TimelineClipboard {
  get(actor: ActorId): ClipboardEntry | undefined;
  set(actor: ActorId, entry: ClipboardEntry): void;
}

/** A stretch of time. */
export type Span = [start: Micros, end: Micros];

/** One track's worth of a paste. */
export interface PastePlacement {
  kind: TrackKind;
  /** Null when no track has room, so a new one is needed. */
  trackId: TrackId | null;
  clips: Clip[];
}

/** A strip between the toolbar and the ruler. */
export interface TimelineTabs extends Scoped {
  id: string;
  component: ComponentType;
}

/** A tool in the timeline's toolbar, drawn before Split, lowest `order` first. */
export interface TimelineTool extends Scoped {
  /** Unique id, `<module>.<name>`. */
  id: string;
  order: number;
  component: ComponentType;
}

/** A strip under the tracks, inside the timeline panel. */
export interface TimelineDock extends Scoped {
  /** Unique id, `<module>.<name>`. */
  id: string;
  component: ComponentType;
}

/** Entries a module adds to the timeline's right-click menu. */
export interface TimelineMenuItems extends Scoped {
  id: string;
  /** Asked when the menu opens, with the lane and time under the click (null off the lanes). */
  items(at: DropTarget | null): MenuItem[];
}

/** Something landing on the timeline. A tile's click is a drop without a place. */
export interface TimelineDrop {
  item:
    | LibraryItem
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
export interface ClipActions extends Scoped {
  id: string;
  /** A double click. True when it took care of it. */
  doubleClick?(clip: Clip): boolean;
  /** Entries of the clip's right-click menu. The clip is selected by then: act on the selection. */
  items?(clip: Clip): ClipMenuEntry[];
  /**
   * Drawn over the clip, in a layer that takes no pointer; a child may turn pointer events back
   * on for itself.
   */
  badge?: ComponentType<{ clip: Clip; selected: boolean }>;
}

/** Where an entry of a clip's menu sits. The menu shows them in this order, top to bottom. */
export type ClipMenuGroup =
  "clipboard" | "timing" | "edit" | "reset" | "composition" | "library" | "delete";

/** One entry of a clip's menu. */
export interface ClipMenuEntry extends Omit<MenuItem, "group">, Scoped {
  group: ClipMenuGroup;
  /** Lower comes first within the group. Defaults to 0. */
  order?: number;
}

/** The page of the virtualized lanes a panel's scroller is on, and how wide a page is (px). */
export interface ScrollerPage {
  page: number;
  pageWidth: number;
}
