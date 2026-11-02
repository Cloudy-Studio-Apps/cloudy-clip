import { appMenuItems, defineModule, keybindings, layoutPanels, LOCAL_ACTOR } from "@/core";
import { removeJunction } from "@/modules/junction";
import { partnersOf, projectRef } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import {
  addClip,
  addElement,
  addTrack,
  deleteClips,
  splitAt,
  timelineCommands,
} from "./timeline.commands";
import { timelineMcpTools } from "./timeline.mcp";
import { timelineDropHandlers } from "./timeline.points";
import { timelineRef } from "./timeline.ref";
import { createTimelineView } from "./timeline.store";
import { TimelinePanel } from "./ui";
import { laneBoxes } from "./ui/lane-boxes";

/** Tracks and clips editing: commands, tools and the timeline panel. */
export const timelineModule = defineModule({
  ref: timelineRef,
  name: "Timeline",
  tier: "core",
  requires: ["project", "element", "junction", "media", "preview"],
  commands: timelineCommands,
  mcpTools: timelineMcpTools,
  setup(ctx) {
    const { store: project, view: compositions } = ctx.require(projectRef);
    const timeline = createTimelineView(
      (id) => partnersOf(project.getState(), id).map((c) => c.id),
      laneBoxes,
      () => project.getState(),
    );
    const { view } = timeline;
    timeline.drop = (drop) => {
      if (ctx.points.get(timelineDropHandlers).some((handler) => handler.handle(drop))) return;
      const { item, start, trackId } = drop;
      const at = { ...(start !== undefined && { start }), ...(trackId && { trackId }) };
      if (item.type === "action") item.place(at);
      else if (item.type === "element") {
        const { kind, props, duration } = item;
        void ctx.bus.run(addElement, { kind, props, duration, ...at });
      } else if (item.type === "media") {
        void ctx.bus.run(addClip, { mediaId: item.id, ...at });
      }
    };
    let shown = compositions.openFor(LOCAL_ACTOR);
    const followOpen = () => {
      const next = compositions.openFor(LOCAL_ACTOR);
      if (next === shown) return;
      timeline.switchComposition(shown, next);
      shown = next;
    };
    ctx.onDispose(compositions.store.subscribe(followOpen));
    ctx.onDispose(project.subscribe(followOpen));
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
    const addTrackEntry = (kind: "video" | "audio", label: string, order: number) => ({
      id: `timeline.add-${kind}`,
      menu: "Tracks",
      label,
      order,
      enabled: () => compositions.openFor(LOCAL_ACTOR) !== null,
      run: () => void ctx.bus.run(addTrack, { kind }),
    });
    ctx.contribute(
      appMenuItems,
      {
        id: "timeline.split",
        menu: "Edit",
        label: "Split",
        order: 30,
        keybinding: "timeline.split",
      },
      {
        id: "timeline.delete",
        menu: "Edit",
        label: "Delete",
        order: 40,
        keybinding: "timeline.delete",
      },
      addTrackEntry("video", "Add video track", 10),
      addTrackEntry("audio", "Add audio track", 20),
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
