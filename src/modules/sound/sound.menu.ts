import { Scissors } from "lucide-react";
import type { StoreApi } from "zustand/vanilla";
import { mediaHasAudio, type MediaApi } from "@/modules/media";
import { followsFileTime, type Clip, type ProjectApi } from "@/modules/project";
import type { ClipActions, TimelineViewState } from "@/modules/timeline";
import type { SoundApi } from "./sound.types";

/**
 * "Strip silence..." in a clip's right-click menu on the Edit page: opens the dialog on the
 * selected clips that have sound of their own (not a video with no sound) (the clip itself when it isn't selected). It cuts
 * picture and sound together and closes the gaps.
 */
export function silenceMenu(
  project: ProjectApi,
  media: MediaApi,
  view: StoreApi<TimelineViewState>,
  openSilence: SoundApi["openSilence"],
): ClipActions {
  return {
    id: "sound.clipMenu",
    items(clip) {
      const state = project.store.getState();
      const hasSound = (one: Clip) =>
        one.compositionRef === undefined &&
        followsFileTime(state, one) &&
        mediaHasAudio(media.getProbe(one.mediaId ?? ""));
      if (!hasSound(clip)) return [];
      const selected = view.getState().selection;
      const chosen = selected.includes(clip.id) ? selected : [clip.id];
      const clipIds = chosen.filter((id) => {
        const one = state.clips[id];
        return one && hasSound(one);
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
