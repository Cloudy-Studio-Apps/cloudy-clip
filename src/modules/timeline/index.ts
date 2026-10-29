/**
 * Timeline module: tracks and clips editing (commands + UI).
 * @module timeline
 */
/** Track and clip commands; `addElement` adds a clip of an element without a file (text). */
export {
  addClip,
  addElement,
  addTrack,
  deleteClips,
  moveClip,
  removeTrack,
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
export { findOverlap, freeTrack } from "./logic/placement";
/** The `timeline.overlap` failure for a spot taken by another clip, with where it is. */
export { overlapError } from "./timeline.guards";
/**
 * The one clip a selection is about: the only selected clip, or the clicked one when the
 * selection is exactly one linked group (a video's picture and sound). Otherwise undefined.
 */
export { selectionSubject } from "./logic/links";
export type { DropTarget, TimelineApi, TimelineViewState, TrimEdge } from "./timeline.types";

/** The create tiles of a side panel (every element's `create` entries for that panel). */
export { CreateTiles } from "./ui/CreateTiles";
/** Module definition, loaded by the app shell. */
export { timelineModule } from "./timeline.module";
/** Handle for `require(timelineRef)` / `useModule(timelineRef)`. */
export { timelineRef } from "./timeline.ref";
