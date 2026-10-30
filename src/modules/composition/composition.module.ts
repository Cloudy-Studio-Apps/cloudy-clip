import { appOverlays, defineModule, LOCAL_ACTOR } from "@/core";
import { librarySections, mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import {
  timelineDropHandlers,
  timelineMenuItems,
  timelineOverlays,
  timelineRef,
  timelineTabs,
} from "@/modules/timeline";
import { compositionCommands, extendToFitOnce } from "./composition.commands";
import { createCompositionDrop } from "./composition.drop";
import { compositionMcpTools } from "./composition.mcp";
import { compositionRef } from "./composition.ref";
import { createCompositionUi } from "./composition.store";
import type { CompositionApi } from "./composition.types";
import {
  CompositionDialogHost,
  CompositionSection,
  CompositionTabs,
  EmptyStart,
  EndMarker,
  WaitingDrop,
} from "./ui";

/** Compositions: their commands and tools, the dialog, the Library section and the tabs. */
export const compositionModule = defineModule({
  ref: compositionRef,
  name: "Compositions",
  tier: "core",
  requires: ["project", "media", "timeline"],
  commands: compositionCommands,
  mcpTools: compositionMcpTools,
  setup(ctx) {
    ctx.contribute(librarySections, { id: "composition.section", component: CompositionSection });
    ctx.contribute(timelineTabs, { id: "composition.tabs", component: CompositionTabs });
    ctx.contribute(
      timelineOverlays,
      { id: "composition.empty", component: EmptyStart },
      { id: "composition.end", component: EndMarker },
      { id: "composition.waiting", component: WaitingDrop },
    );
    const project = ctx.require(projectRef);
    const { view } = project;
    const timeline = ctx.require(timelineRef);
    const ui = createCompositionUi();
    const { handler, cancelWaiting, dropPending } = createCompositionDrop({
      bus: ctx.bus,
      project,
      media: ctx.require(mediaRef),
      api: ui,
    });
    ctx.onDispose(cancelWaiting);
    ctx.contribute(timelineDropHandlers, handler);
    const api: CompositionApi = {
      ...ui,
      cancelWaiting,
      landPending() {
        const drop = dropPending();
        if (drop) timeline.drop(drop);
      },
    };
    ctx.contribute(timelineMenuItems, {
      id: "composition.menu",
      items() {
        const compositionId = view.openFor(LOCAL_ACTOR);
        if (compositionId === null) return [];
        return [
          { label: "Composition Settings", onSelect: () => api.openSettings(compositionId) },
          {
            label: "Extend to fit",
            onSelect: () => void ctx.bus.run(extendToFitOnce, { compositionId }),
          },
        ];
      },
    });
    ctx.contribute(appOverlays, { id: "composition.dialog", component: CompositionDialogHost });
    return { api };
  },
});
