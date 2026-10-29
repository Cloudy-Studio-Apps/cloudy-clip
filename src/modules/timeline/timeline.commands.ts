import {
  addClip,
  deleteClips,
  moveClip,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.clip.commands";
import { addElement } from "./timeline.element.command";
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
export { addElement } from "./timeline.element.command";

/** Every command the timeline registers: tracks (`timeline.track.commands.ts`) and clips. */
export const timelineCommands = [
  addTrack,
  removeTrack,
  addClip,
  addElement,
  moveClip,
  trimClip,
  splitAt,
  deleteClips,
  unlinkClips,
  setTrackMuted,
  setTrackHidden,
];
