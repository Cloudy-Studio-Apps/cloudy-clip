import { useCallback } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { formatOf, frameDuration, projectRef } from "@/modules/project";
import type { KeyRef, KeySnap } from "../keyframe.types";
import { snapTargets } from "../logic/snap";

/**
 * What a drag of `dragged` keys snaps to, read when it starts: the playhead, the ends of the keys'
 * clips and their other keys, and the frame of the first key's clip. The answer asked at each move
 * has no targets while Ctrl is held; frames always apply.
 */
export function useKeySnap(): (dragged: readonly KeyRef[]) => (ctrl: boolean) => KeySnap {
  const project = useModule(projectRef).store;
  const { playback } = useModule(previewRef);
  return useCallback(
    (dragged) => {
      const state = project.getState();
      const first = dragged[0] ? state.clips[dragged[0].clipId] : undefined;
      const frame = first ? frameDuration(formatOf(state, first)) : 0;
      const targets = snapTargets(state.clips, dragged, playback.getTime());
      return (ctrl) => ({ targets: ctrl ? [] : targets, frame });
    },
    [project, playback],
  );
}
