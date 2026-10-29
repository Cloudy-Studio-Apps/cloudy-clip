import { defineModule, keybindings, layoutPanels } from "@/core";
import { removeJunction } from "@/modules/junction";
import { partnersOf, projectRef } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { deleteClips, splitAt, timelineCommands } from "./timeline.commands";
import { timelineMcpTools } from "./timeline.mcp";
import { timelineRef } from "./timeline.ref";
import { createTimelineView } from "./timeline.store";
import { TimelinePanel } from "./ui";
import { highlightLane, laneBoxes } from "./ui/lane-boxes";

/** Tracks and clips editing: commands, tools and the timeline panel. */
export const timelineModule = defineModule({
  ref: timelineRef,
  name: "Timeline",
  tier: "core",
  requires: ["project", "element", "junction", "media", "preview"],
  commands: timelineCommands,
  mcpTools: timelineMcpTools,
  setup(ctx) {
    const project = ctx.require(projectRef).store;
    const timeline = createTimelineView(
      (id) => partnersOf(project.getState(), id).map((c) => c.id),
      laneBoxes,
      () => project.getState(),
      highlightLane,
    );
    const { view } = timeline;
    ctx.contribute(layoutPanels, {
      id: "timeline.panel",
      title: "Timeline",
      slot: "bottom",
      component: TimelinePanel,
    });

    const deleteSelection = () => {
      const { selection: clipIds, junctionSelection: junctionIds } = view.getState();
      if (junctionIds.length > 0) return { command: removeJunction.id, input: { junctionIds } };
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
              at: ctx.require(previewRef).playback.getTime(),
              clipIds: selection.length > 0 ? selection : undefined,
            },
          };
        },
      },
      { id: "timeline.delete", key: "delete", resolve: deleteSelection },
      { id: "timeline.delete-backspace", key: "backspace", resolve: deleteSelection },
    );

    // Drop selected clips and junctions that no longer exist (deleted, undone, removed by an agent).
    const offProject = project.subscribe((state, previous) => {
      const { selection, junctionSelection } = view.getState();
      if (state.clips !== previous.clips) {
        const kept = selection.filter((id) => state.clips[id]);
        if (kept.length !== selection.length) view.setState({ selection: kept });
      }
      if (state.junctions !== previous.junctions) {
        const kept = junctionSelection.filter((id) => state.junctions[id]);
        if (kept.length !== junctionSelection.length) view.setState({ junctionSelection: kept });
      }
    });
    return { api: timeline, dispose: offProject };
  },
});
