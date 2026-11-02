import { Gauge } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import type { ModuleContext } from "@/core";
import { canChangeSpeed, projectRef } from "@/modules/project";
import { selectionSubject } from "@/modules/timeline";
import type { ClipActions, ClipMenuEntry, TimelineViewState } from "@/modules/timeline";
import type { SpeedView } from "./speed.types";

/** Speed... in a clip's menu: for one clip that plays a file. It opens the box above the clip. */
export function speedMenu(
  ctx: ModuleContext,
  timeline: StoreApi<TimelineViewState>,
  view: StoreApi<SpeedView>,
): ClipActions {
  return {
    id: "speed.clip",
    items(clip) {
      const state = ctx.require(projectRef).store.getState();
      const single = selectionSubject(state, timeline.getState().selection) !== undefined;
      const entries: ClipMenuEntry[] = [];
      if (single && canChangeSpeed(state, clip)) {
        entries.push({
          group: "timing",
          icon: Gauge,
          label: "Speed...",
          onSelect: () => view.setState({ boxClipId: clip.id }),
        });
      }
      return entries;
    },
  };
}
