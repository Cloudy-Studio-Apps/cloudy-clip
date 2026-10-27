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
} from "./timeline.commands";
export type { TimelineApi, TimelineViewState, TrimEdge } from "./timeline.types";

/** Module definition, loaded by the app shell. */
export { timelineModule } from "./timeline.module";
/** Handle for `require(timelineRef)` / `useModule(timelineRef)`. */
export { timelineRef } from "./timeline.ref";
