import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { notify, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { projectRef } from "@/modules/project";
import type { SideSource } from "../tint.types";
import { useTintSet } from "./view.set.hook";

/**
 * The picture side by side shows on the left: a still's saved image, or another clip's frame
 * captured (`captureAt` with `only`, graded as it is) for the clip and time chosen, again only
 * when that clip's grade changes (never per frame); the old picture stays up meanwhile. Null until
 * the first one lands. A failed capture tells the user and ends side by side.
 */
export function useSideImage(source: SideSource): string | null {
  const project = useModule(projectRef);
  const preview = useModule(previewRef);
  const set = useTintSet();
  const stillId = source.kind === "still" ? source.stillId : null;
  const clipId = source.kind === "clip" ? source.clipId : null;
  const time = source.kind === "clip" ? source.time : 0;
  const still = useStore(project.store.api, (s) => (stillId ? s.stills?.[stillId]?.image : null));
  const grade = useStore(project.store.api, (s) => (clipId ? s.clips[clipId]?.grade : undefined));
  const [made, setMade] = useState<string | null>(null);
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
      (src) => live && setMade(src),
      (error) => {
        if (!live) return;
        notify("error", `Couldn't show that clip beside the picture: ${String(error)}`);
        set({ side: null });
      },
    );
    return () => {
      live = false;
    };
  }, [project, preview, set, clipId, time, grade]);
  // The previous picture stays until the new one lands (no blank flash).
  return stillId ? (still ?? null) : made;
}
