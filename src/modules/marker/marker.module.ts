import { defineModule, keybindings } from "@/core";
import { previewRef } from "@/modules/preview";
import { compositionMarkers, projectRef } from "@/modules/project";
import {
  clipActions,
  timelineMenuItems,
  timelineOverlays,
  timelineSnapTargets,
} from "@/modules/timeline";
import { markerCommands } from "./marker.commands";
import { markerKeys } from "./marker.keys";
import { markerMcpTools } from "./marker.mcp";
import { markerMenus } from "./marker.menu";
import { markerRef } from "./marker.ref";
import { createMarkerUi } from "./marker.store";
import { MarkerFlags } from "./ui";

/** Markers: bookmarks on a composition's timeline, for the user and agents alike. */
export const markerModule = defineModule({
  ref: markerRef,
  name: "Markers",
  tier: "feature",
  requires: ["project", "timeline", "preview"],
  commands: markerCommands,
  mcpTools: markerMcpTools,
  setup(ctx) {
    const project = ctx.require(projectRef);
    const ui = createMarkerUi();
    ctx.contribute(keybindings, ...markerKeys(project, ctx.require(previewRef), ui));
    ctx.contribute(timelineSnapTargets, {
      id: "marker.times",
      times: (state, compositionId) => compositionMarkers(state, compositionId).map((m) => m.time),
    });
    const menus = markerMenus(ctx.bus, project, ui);
    ctx.contribute(timelineMenuItems, menus.timeline);
    ctx.contribute(clipActions, menus.clip);
    ctx.contribute(timelineOverlays, {
      id: "marker.flags",
      scopes: ["all", "sound"],
      component: MarkerFlags,
    });
    return { api: { ui } };
  },
});
