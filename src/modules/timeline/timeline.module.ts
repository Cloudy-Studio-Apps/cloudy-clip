import { defineModule, keybindings, layoutPanels } from "@/core";
import { projectStore } from "@/modules/project";
import { playback } from "@/modules/preview";
import { deleteClips, splitAt, timelineCommands } from "./timeline.commands";
import { timelineMcpTools } from "./timeline.mcp";
import { timelineRef } from "./timeline.ref";
import { createTimelineView } from "./timeline.store";
import { TimelinePanel } from "./ui";

/** Tracks and clips editing: commands, tools and the timeline panel. */
export const timelineModule = defineModule({
  ref: timelineRef,
  name: "Timeline",
  tier: "core",
  requires: ["project", "media", "preview"],
  commands: timelineCommands,
  mcpTools: timelineMcpTools,
  setup(ctx) {
    const timeline = createTimelineView();
    const { view } = timeline;
    ctx.contribute(layoutPanels, {
      id: "timeline.panel",
      title: "Timeline",
      slot: "bottom",
      component: TimelinePanel,
    });

    const deleteSelection = () => {
      const clipIds = view.getState().selection;
      return clipIds.length > 0 ? { command: deleteClips.id, input: { clipIds } } : null;
    };
    ctx.contribute(
      keybindings,
      {
        id: "timeline.split",
        key: "s",
        resolve: () => {
          const selection = view.getState().selection;
          return {
            command: splitAt.id,
            input: {
              at: playback.getTime(),
              clipIds: selection.length > 0 ? selection : undefined,
            },
          };
        },
      },
      { id: "timeline.delete", key: "delete", resolve: deleteSelection },
      { id: "timeline.delete-backspace", key: "backspace", resolve: deleteSelection },
    );

    // Drop selected clips that no longer exist (deleted, undone, removed by an agent).
    const offProject = projectStore.subscribe((state, previous) => {
      if (state.clips === previous.clips) return;
      const { selection } = view.getState();
      const kept = selection.filter((id) => state.clips[id]);
      if (kept.length !== selection.length) view.setState({ selection: kept });
    });
    return { api: timeline, dispose: offProject };
  },
});
