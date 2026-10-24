/**
 * Timeline module: tracks and clips editing (commands + UI).
 * @module timeline
 */
import type { ModuleDefinition } from "@/core";
import { projectStore } from "@/modules/project";
import { timelineCommands } from "./timeline.commands";
import { timelineMcpTools } from "./timeline.mcp";
import { timelineViewStore } from "./timeline.store";

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
export { selectClip, setZoom, timelineViewStore } from "./timeline.store";
export { TimelinePanel } from "./components/TimelinePanel";
export type { TimelineViewState, TrimEdge } from "./timeline.types";

/** Module definition, loaded by the app shell. */
export const timelineModule: ModuleDefinition = {
  id: "timeline",
  name: "Timeline",
  commands: timelineCommands,
  mcpTools: timelineMcpTools,
  activate() {
    // Drop selected clips that no longer exist (deleted, undone, removed by an agent).
    return projectStore.subscribe((state, previous) => {
      if (state.clips === previous.clips) return;
      const { selection } = timelineViewStore.getState();
      const kept = selection.filter((id) => state.clips[id]);
      if (kept.length !== selection.length) timelineViewStore.setState({ selection: kept });
    });
  },
};
