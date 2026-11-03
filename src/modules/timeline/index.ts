/**
 * Timeline module: tracks and clips editing (commands + UI).
 * @module timeline
 */
/** Track and clip commands; `addElement` adds a clip of an element without a file (text). */
export {
  addClip,
  addElement,
  addTrack,
  copyClips,
  cutClips,
  deleteClips,
  duplicateClips,
  linkClips,
  moveClip,
  pasteClips,
  removeTrack,
  rippleDelete,
  setClipsDisabled,
  setTrackHidden,
  setTrackMuted,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.commands";
/**
 * Placement checks for modules that put their own clips on the timeline (text): the first clip
 * overlapping a span on a track, the first track of a kind with room for a span, and the
 * `timeline.overlap` failure that explains a clash.
 */
export {
  findOverlap,
  freeTrack,
  minClipDuration,
  neighbourBounds,
  sortClipIds,
  trackEnd,
} from "./logic/placement";
/**
 * What commands that change clips share: writing a worked-out state as one undo step, the
 * layout check, and shrinking junctions that no longer fit, for modules with their own clip edits.
 */
export { commitState, fitJunctions, junctionKindOf } from "./timeline.junctions";
/** Layers over the lanes; contribute with `ctx.contribute(timelineOverlays, …)`. */
export {
  clipActions,
  timelineDropHandlers,
  timelineMenuItems,
  timelineDocks,
  timelineOverlays,
  timelineSnapTargets,
  timelineTabs,
  timelineTools,
} from "./timeline.points";
/**
 * Point: controls on a track's header after its own buttons (`sound`'s solo and record-arm), by
 * `order`, each given its track. Scoped like every timeline contribution: unset means the editor
 * only.
 */
export { timelineTrackControls } from "./timeline.points";
/**
 * `HEADER_WIDTH` is the default width of the track headers; `RULER_HEIGHT` is the ruler's height;
 * `SNAP_PX` is how near, in px, a drag must come to a target to snap to it.
 */
export { HEADER_WIDTH, RULER_HEIGHT, SNAP_PX } from "./timeline.layout";
/** The height of a track's lane by kind, in px, for an overlay that draws a lane of its own. */
export { trackHeight } from "./timeline.layout";
/**
 * Height of the rows above the first lane in px, by scope: the ruler, plus the marks row on
 * `"sound"`. The one answer to where the lanes start, for an overlay that measures from there.
 */
export { rowsAbove } from "./timeline.layout";
/**
 * Where flags go in the panel a component sits in (`{ top, height }`, px from the top of the
 * content): the ruler on the editor's timeline, the marks row under it on a sound-scope one. A
 * `timelineOverlays` entry that draws a flag or a mark in time places itself with it.
 */
export { useFlagRow } from "./ui/flag.row.hook";
/**
 * The width of the track header column in px, as a hook: where time 0 starts in the timeline's
 * content. A timeline overlay positions itself with it, not with `HEADER_WIDTH`, which is only
 * the default.
 */
export { useHeaderWidth } from "./ui/header.width.hook";
/** The clips a scope lists (`"sound"`: those on audio tracks). */
export { clipsInScope } from "./logic/scope";
/**
 * The scope of the timeline panel a component sits in (`"all"` outside one), for what a module
 * draws inside the panel (a dock, an overlay) to list only what that scope may touch.
 */
export { useTimelineScope } from "./ui/scope.hook";
/** Pixels from time 0 to a time at a zoom level, and back. */
export { pxToTime, timeToPx } from "./logic/geometry";
/**
 * The input of a split at the playhead: the selected clips, or every clip under it when nothing is
 * selected. For a page's own Cut, so it splits exactly as S and the toolbar do.
 */
export { playheadSplit } from "./logic/split";
/**
 * The name `timeline.addTrack` gives a new track (`Audio 3`), or with a `base` the first free
 * `<base> n` (`Voice 1`), for a module that adds its own kind of track.
 */
export { nextTrackName } from "./logic/naming";
/** Snaps a time to the closest candidate within a threshold. */
export { snapTime } from "./logic/placement";
/** What drags snap to (clip edges, cuts, the playhead and `timelineSnapTargets`), as a hook. */
export { useSnapCandidates } from "./ui/snap.hook";
/** The `timeline.overlap` failure for a spot taken by another clip, with where it is. */
export { checkLayout, overlapError } from "./timeline.guards";
/**
 * The one clip a selection is about: the only selected clip, or the clicked one when the
 * selection is exactly one linked group (a video's picture and sound). Otherwise undefined.
 */
export { selectionSubject } from "./logic/links";
export type {
  ClipActions,
  ClipboardEntry,
  FlagRow,
  ClipMenuEntry,
  ClipMenuGroup,
  Scoped,
  ScreenBox,
  TimelineDrop,
  TimelineDock,
  TimelineDropHandler,
  TimelineMenuItems,
  TimelineOverlay,
  TimelineSnapTarget,
  SnapCandidates,
  TimelineTool,
  TimelineTrackControl,
  CutPreview,
  DropTarget,
  JunctionKindOf,
  TimelineApi,
  TimelineViewState,
  TrackFocus,
  TrimEdge,
} from "./timeline.types";

/** The create tiles of a side panel (every element's `create` entries for that panel). */
export { CreateTiles } from "./ui/CreateTiles";
/** The press of a create tile: a click, or a drag with a ghost to where it drops on the timeline. */
export { startCreateDrag } from "./ui/create.gesture";
/**
 * The timeline panel, for a page of its own: `scope` (`"sound"` lists audio tracks and what opted
 * in), `focus` (a track the page keeps in focus, marked on its header).
 */
export { TimelinePanel } from "./ui/TimelinePanel";
/** Module definition, loaded by the app shell. */
export { timelineModule } from "./timeline.module";
/** Handle for `require(timelineRef)` / `useModule(timelineRef)`. */
export { timelineRef } from "./timeline.ref";
