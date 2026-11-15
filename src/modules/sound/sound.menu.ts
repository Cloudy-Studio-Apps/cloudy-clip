import { Scissors } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import { followsFileTime, type ProjectApi } from "@/modules/project";
import type { ClipActions, TimelineViewState } from "@/modules/timeline";
import type { SoundApi } from "./sound.types";

/**
 * "Strip silence..." in a clip's right-click menu on the Edit page: opens the dialog on the
 * selected clips that have sound of their own (the clip itself when it isn't selected). It cuts
 * picture and sound together and closes the gaps.
 */
export function silenceMenu(
  project: ProjectApi,
  view: StoreApi<TimelineViewState>,
  openSilence: SoundApi["openSilence"],
): ClipActions {
  return {
    id: "sound.clipMenu",
    items(clip) {
      const state = project.store.getState();
      if (!followsFileTime(state, clip) || clip.compositionRef !== undefined) return [];
      const selected = view.getState().selection;
      const chosen = selected.includes(clip.id) ? selected : [clip.id];
      const clipIds = chosen.filter((id) => {
        const one = state.clips[id];
        return one && followsFileTime(state, one) && one.compositionRef === undefined;
      });
      return [
        {
          label: "Strip silence...",
          icon: Scissors,
          group: "edit",
          onSelect: () => openSilence({ clipIds, soundOnly: false }),
        },
      ];
    },
  };
}
