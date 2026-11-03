import { Copy, Group } from "lucide-react";
import { appMenuItems, appOverlays, defineModule, LOCAL_ACTOR } from "@/core";
import { elements } from "@/modules/element";
import { librarySections, mediaRef } from "@/modules/media";
import { projectRef } from "@/modules/project";
import {
  clipActions,
  timelineDropHandlers,
  timelineMenuItems,
  timelineOverlays,
  timelineRef,
  timelineTabs,
} from "@/modules/timeline";
import { compositionCommands, extendToFitOnce, openComposition } from "./composition.commands";
import { createCompositionDrop } from "./composition.drop";
import { groupClips } from "./composition.group.command";
import { compositionElement } from "./composition.element";
import { compositionMcpTools } from "./composition.mcp";
import { compositionRef } from "./composition.ref";
import { createCompositionUi } from "./composition.store";
import { makeUnique } from "./composition.unique.command";
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
  requires: ["project", "element", "media", "timeline"],
  commands: compositionCommands,
  mcpTools: compositionMcpTools,
  setup(ctx) {
    ctx.contribute(elements, compositionElement);
    ctx.contribute(librarySections, { id: "composition.section", component: CompositionSection });
    ctx.contribute(timelineTabs, {
      id: "composition.tabs",
      scopes: ["all", "sound"],
      component: CompositionTabs,
    });
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
    ctx.contribute(
      appMenuItems,
      {
        id: "composition.new",
        menu: "Composition",
        label: "New composition…",
        order: 10,
        run: ui.openNew,
      },
      {
        id: "composition.settings",
        menu: "Composition",
        label: "Composition settings…",
        order: 20,
        enabled: () => view.openFor(LOCAL_ACTOR) !== null,
        run: () => {
          const id = view.openFor(LOCAL_ACTOR);
          if (id !== null) ui.openSettings(id);
        },
      },
    );
    ctx.contribute(clipActions, {
      id: "composition.clip",
      doubleClick({ compositionRef }) {
        if (compositionRef === undefined) return false;
        void ctx.bus.run(openComposition, { compositionId: compositionRef });
        return true;
      },
      items(clip) {
        const { selection } = timeline.view.getState();
        const clipIds = selection.includes(clip.id) ? selection : [clip.id];
        return [
          {
            group: "composition",
            icon: Group,
            label: "Group into composition",
            onSelect: () => void ctx.bus.run(groupClips, { clipIds }),
          },
          ...(clip.compositionRef === undefined
            ? []
            : [
                {
                  group: "composition" as const,
                  icon: Copy,
                  label: "Make unique",
                  onSelect: () => void ctx.bus.run(makeUnique, { clipId: clip.id }),
                },
              ]),
        ];
      },
    });
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
