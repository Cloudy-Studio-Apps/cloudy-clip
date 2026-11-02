import { RotateCcw } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import type { ModuleContext } from "@/core";
import { projectRef } from "@/modules/project";
import type { ClipActions, TimelineViewState } from "@/modules/timeline";
import { resetTransform } from "./transform.commands";

/** Reset transform in a clip's menu: for pictures, which are what the transform places. */
export function transformMenu(ctx: ModuleContext, view: StoreApi<TimelineViewState>): ClipActions {
  return {
    id: "transform.clip",
    items(clip) {
      const state = ctx.require(projectRef).store.getState();
      if (state.tracks[clip.trackId]?.kind !== "video") return [];
      const clipIds = view
        .getState()
        .selection.filter((id) => state.tracks[state.clips[id]?.trackId ?? ""]?.kind === "video");
      return [
        {
          group: "reset",
          icon: RotateCcw,
          label: "Reset transform",
          onSelect: () => void ctx.bus.run(resetTransform, { clipIds }),
        },
      ];
    },
  };
}
