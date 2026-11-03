import { Bookmark, BookmarkPlus } from "lucide-react";
import { LOCAL_ACTOR, type CommandBus } from "@/core";
import { frameDuration, type ProjectApi } from "@/modules/project";
import type { ClipActions, TimelineMenuItems } from "@/modules/timeline";
import type { StoreApi } from "zustand/vanilla";
import { addMarker } from "./marker.commands";
import { floorToFrame } from "./logic/markers";
import type { MarkerUiState } from "./marker.types";

/**
 * "Add marker here" (where the timeline was right-clicked) and "Add marker at playhead" (M), in
 * the timeline's menu and in a clip's, so markers can be added without the key.
 */
export function markerMenus(
  bus: CommandBus,
  project: ProjectApi,
  ui: StoreApi<MarkerUiState>,
): { timeline: TimelineMenuItems; clip: ClipActions } {
  const atPlayhead = () => ({
    label: "Add marker at playhead",
    icon: Bookmark,
    shortcut: "M",
    onSelect: () => void bus.run(addMarker, { color: ui.getState().lastColor }),
  });
  return {
    timeline: {
      id: "marker.menu",
      items(at) {
        const id = project.view.openFor(LOCAL_ACTOR);
        const composition = id ? project.store.getState().compositions[id] : undefined;
        if (!composition) return [];
        const here = at && {
          label: "Add marker here",
          icon: BookmarkPlus,
          group: "marker",
          onSelect: () =>
            void bus.run(addMarker, {
              compositionId: composition.id,
              time: floorToFrame(at.time, frameDuration(composition.format)),
              color: ui.getState().lastColor,
            }),
        };
        return [...(here ? [here] : []), { ...atPlayhead(), group: "marker" }];
      },
    },
    clip: {
      id: "marker.clipMenu",
      items: () => [{ ...atPlayhead(), group: "timing", order: 100 }],
    },
  };
}
