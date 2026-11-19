import { FlipHorizontal2, FlipVertical2, RotateCcw } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import type { ModuleContext } from "@/core";
import { projectRef } from "@/modules/project";
import type { ClipActions, TimelineViewState } from "@/modules/timeline";
import { flipTransform, resetTransform } from "./transform.commands";

/** Flip and Reset transform in a clip's menu: for pictures, which are what the transform places. */
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
          icon: FlipHorizontal2,
          label: "Flip horizontally",
          onSelect: () => void ctx.bus.run(flipTransform, { clipIds, axis: "horizontal" }),
        },
        {
          group: "reset",
          icon: FlipVertical2,
          label: "Flip vertically",
          onSelect: () => void ctx.bus.run(flipTransform, { clipIds, axis: "vertical" }),
        },
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
