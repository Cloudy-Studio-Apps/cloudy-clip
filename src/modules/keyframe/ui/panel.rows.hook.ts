import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { compositionClips, projectRef, useOpenComposition } from "@/modules/project";
import { clipsInScope, timelineRef, useTimelineScope } from "@/modules/timeline";
import { keyframeRef } from "../keyframe.ref";
import type { PanelClip } from "../keyframe.types";

/**
 * The clips the panel lists: the selected ones, or every animated clip of the open composition
 * with scope `all`. Only clips with keys, each with the fields that have them. In a sound-scope
 * timeline only clips on audio tracks are listed, never a picture's.
 */
export function usePanelRows(): PanelClip[] {
  const keyframes = useModule(keyframeRef);
  const timeline = useModule(timelineRef);
  const state = useStore(useModule(projectRef).store.api, (s) => s);
  const selection = useStore(timeline.view, (s) => s.selection);
  const scope = useStore(keyframes.view, (s) => s.scope);
  const open = useOpenComposition();
  const timelineScope = useTimelineScope();

  return useMemo(() => {
    const clips =
      scope === "all"
        ? open
          ? compositionClips(state, open.id)
          : []
        : selection.flatMap((id) => state.clips[id] ?? []);
    return clipsInScope(state, clips, timelineScope).flatMap((clip) => {
      const fields = keyframes.fieldsOf(clip).filter((f) => clip.animation?.[f.path]);
      return fields.length > 0 ? [{ clip, fields }] : [];
    });
  }, [keyframes, state, selection, scope, open, timelineScope]);
}
