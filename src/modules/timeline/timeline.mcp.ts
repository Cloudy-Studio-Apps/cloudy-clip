import { commandTool } from "@/core";
import {
  addClip,
  addElement,
  addTrack,
  deleteClips,
  linkClips,
  moveClip,
  removeTrack,
  rippleDelete,
  setClipsDisabled,
  setTrackHidden,
  setTrackMuted,
  splitAt,
  trimClip,
  unlinkClips,
} from "./timeline.commands";

/** Every timeline edit is available to agents, with the same rules as the UI. */
export const timelineMcpTools = [
  commandTool(addTrack, { name: "timeline_add_track" }),
  commandTool(removeTrack, { name: "timeline_remove_track" }),
  commandTool(addClip, { name: "timeline_add_clip" }),
  commandTool(addElement, { name: "timeline_add_element" }),
  commandTool(moveClip, { name: "timeline_move_clip" }),
  commandTool(trimClip, { name: "timeline_trim_clip" }),
  commandTool(splitAt, { name: "timeline_split" }),
  commandTool(deleteClips, { name: "timeline_delete_clips" }),
  commandTool(rippleDelete, { name: "timeline_ripple_delete" }),
  commandTool(unlinkClips, { name: "timeline_unlink_clips" }),
  commandTool(linkClips, { name: "timeline_link_clips" }),
  commandTool(setClipsDisabled, { name: "timeline_set_clips_disabled" }),
  commandTool(setTrackMuted, { name: "timeline_set_track_muted" }),
  commandTool(setTrackHidden, { name: "timeline_set_track_hidden" }),
];
