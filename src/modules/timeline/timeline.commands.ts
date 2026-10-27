import {
  addClip,
  deleteClips,
  moveClip,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.clip.commands";
import { addTrack, removeTrack, setTrackHidden, setTrackMuted } from "./timeline.track.commands";

export {
  addClip,
  deleteClips,
  moveClip,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.clip.commands";
export { addTrack, removeTrack, setTrackHidden, setTrackMuted } from "./timeline.track.commands";

/** Every command the timeline registers: tracks (`timeline.track.commands.ts`) and clips. */
export const timelineCommands = [
  addTrack,
  removeTrack,
  addClip,
  moveClip,
  trimClip,
  splitAt,
  deleteClips,
  unlinkClips,
  setTrackMuted,
  setTrackHidden,
];
