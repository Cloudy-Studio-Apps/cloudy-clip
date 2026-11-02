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
export { findOverlap, freeTrack, minClipDuration, sortClipIds, trackEnd } from "./logic/placement";
/** Layers over the lanes; contribute with `ctx.contribute(timelineOverlays, …)`. */
export {
  clipActions,
  timelineDropHandlers,
  timelineMenuItems,
  timelineOverlays,
  timelineTabs,
} from "./timeline.points";
/** Width of the track headers, where time 0 starts in a timeline overlay. */
export { HEADER_WIDTH, RULER_HEIGHT } from "./timeline.layout";
/** Pixels from time 0 to a time at a zoom level. */
export { timeToPx } from "./logic/geometry";
/** The `timeline.overlap` failure for a spot taken by another clip, with where it is. */
export { overlapError } from "./timeline.guards";
/**
 * The one clip a selection is about: the only selected clip, or the clicked one when the
 * selection is exactly one linked group (a video's picture and sound). Otherwise undefined.
 */
export { selectionSubject } from "./logic/links";
export type {
  ClipActions,
  ClipboardEntry,
  ClipMenuEntry,
  ClipMenuGroup,
  ScreenBox,
  TimelineDrop,
  TimelineDropHandler,
  TimelineOverlay,
  CutPreview,
  DropTarget,
  TimelineApi,
  TimelineViewState,
  TrimEdge,
} from "./timeline.types";

/** The create tiles of a side panel (every element's `create` entries for that panel). */
export { CreateTiles } from "./ui/CreateTiles";
/** The press of a create tile: a click, or a drag with a ghost to where it drops on the timeline. */
export { startCreateDrag } from "./ui/create.gesture";
/** Module definition, loaded by the app shell. */
export { timelineModule } from "./timeline.module";
/** Handle for `require(timelineRef)` / `useModule(timelineRef)`. */
export { timelineRef } from "./timeline.ref";
