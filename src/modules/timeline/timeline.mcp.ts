import { commandTool } from "@/core";
import {
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

/** Every timeline edit is available to agents, with the same rules as the UI. */
export const timelineMcpTools = [
  commandTool(addTrack, { name: "timeline_add_track" }),
  commandTool(removeTrack, { name: "timeline_remove_track" }),
  commandTool(addClip, { name: "timeline_add_clip" }),
  commandTool(moveClip, { name: "timeline_move_clip" }),
  commandTool(trimClip, { name: "timeline_trim_clip" }),
  commandTool(splitAt, { name: "timeline_split" }),
  commandTool(deleteClips, { name: "timeline_delete_clips" }),
  commandTool(setTrackMuted, { name: "timeline_set_track_muted" }),
  commandTool(setTrackHidden, { name: "timeline_set_track_hidden" }),
];
