import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { notify, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import type { SideSource } from "../tint.types";
import { useTintSet } from "./view.set.hook";

/**
 * The picture side by side shows on the left: a still's saved image, or another clip's frame
 * captured (`captureAt` with `only`, graded as it is) once for the clip and time chosen. It is
 * kept until the choice changes, never captured per frame, so a later grade edit of that clip
 * shows when it is chosen again. Null while it is being made. A failed capture tells the user and
 * ends side by side.
 */
export function useSideImage(source: SideSource): string | null {
  const project = useModule(projectRef);
  const preview = useModule(previewRef);
  const set = useTintSet();
  const stillId = source.kind === "still" ? source.stillId : null;
  const clipId = source.kind === "clip" ? source.clipId : null;
  const time = source.kind === "clip" ? source.time : 0;
  const still = useStore(project.store.api, (s) => (stillId ? s.stills?.[stillId]?.image : null));
  const [made, setMade] = useState<{ key: string; src: string } | null>(null);
  const key = `${clipId}@${time}`;
  useEffect(() => {
    if (!clipId) return;
    const state = project.store.getState();
    const clip = state.clips[clipId];
    const compositionId = clip && state.tracks[clip.trackId]?.compositionId;
    if (!compositionId) {
      set({ side: null });
      return;
    }
    let live = true;
    preview.captureAt(time, compositionId, { only: clipId }).then(
      (src) => live && setMade({ key, src }),
      (error) => {
        if (!live) return;
        notify("error", `Couldn't show that clip beside the picture: ${String(error)}`);
        set({ side: null });
      },
    );
    return () => {
      live = false;
    };
  }, [project, preview, set, clipId, time, key]);
  return stillId ? (still ?? null) : made?.key === key ? made.src : null;
}
