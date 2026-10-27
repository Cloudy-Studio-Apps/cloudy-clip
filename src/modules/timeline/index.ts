/**
 * Timeline module: tracks and clips editing (commands + UI).
 * @module timeline
 */
export {
  addClip,
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
 * The one clip a selection is about: the only selected clip, or the clicked one when the
 * selection is exactly one linked group (a video's picture and sound). Otherwise undefined.
 */
export { selectionSubject } from "./logic/links";
export type { TimelineApi, TimelineViewState, TrimEdge } from "./timeline.types";

/** Module definition, loaded by the app shell. */
export { timelineModule } from "./timeline.module";
/** Handle for `require(timelineRef)` / `useModule(timelineRef)`. */
export { timelineRef } from "./timeline.ref";
