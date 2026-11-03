import { Volume2 } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import type { ModuleContext } from "@/core";
import { partnersOf, projectRef, type ClipId, type ProjectState } from "@/modules/project";
import type { ClipActions, TimelineViewState } from "@/modules/timeline";
import { resetSound } from "./audio.commands";

const hasSound = (state: ProjectState, id: ClipId) => {
  const clip = state.clips[id];
  return (
    clip !== undefined &&
    [clip, ...partnersOf(state, id)].some(
      (one) =>
        one.sound || Object.keys(one.animation ?? {}).some((path) => path.startsWith("sound.")),
    )
  );
};

/** Reset sound in a clip's menu, for clips whose sound was changed. */
export function audioMenu(ctx: ModuleContext, view: StoreApi<TimelineViewState>): ClipActions {
  return {
    id: "audio.clip",
    items(clip) {
      const state = ctx.require(projectRef).store.getState();
      if (!hasSound(state, clip.id)) return [];
      const clipIds = view.getState().selection.filter((id) => hasSound(state, id));
      return [
        {
          group: "reset",
          order: 10,
          icon: Volume2,
          label: "Reset sound",
          onSelect: () => void ctx.bus.run(resetSound, { clipIds }),
        },
      ];
    },
  };
}
