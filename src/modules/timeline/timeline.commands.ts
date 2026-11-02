import { addClip, unlinkClips } from "./timeline.clip.commands";
import { moveClip, trimClip } from "./timeline.move.commands";
import { deleteClips, splitAt } from "./timeline.split.commands";
import { addElement } from "./timeline.element.command";
import { setClipsDisabled } from "./timeline.enable.command";
import { linkClips } from "./timeline.link.command";
import { rippleDelete } from "./timeline.ripple.command";
import { addTrack, removeTrack, setTrackHidden, setTrackMuted } from "./timeline.track.commands";

export { addClip, unlinkClips } from "./timeline.clip.commands";
export { moveClip, trimClip } from "./timeline.move.commands";
export { deleteClips, splitAt } from "./timeline.split.commands";
export { addTrack, removeTrack, setTrackHidden, setTrackMuted } from "./timeline.track.commands";
export { addElement } from "./timeline.element.command";
export { setClipsDisabled } from "./timeline.enable.command";
export { linkClips } from "./timeline.link.command";
export { rippleDelete } from "./timeline.ripple.command";

/**
 * Every command the timeline registers: tracks (`timeline.track.commands.ts`) and clips (add and
 * unlink in `timeline.clip.commands.ts`, move/trim and split/delete in their own files).
 */
export const timelineCommands = [
  addTrack,
  removeTrack,
  addClip,
  addElement,
  moveClip,
  trimClip,
  splitAt,
  deleteClips,
  rippleDelete,
  unlinkClips,
  linkClips,
  setClipsDisabled,
  setTrackMuted,
  setTrackHidden,
];
