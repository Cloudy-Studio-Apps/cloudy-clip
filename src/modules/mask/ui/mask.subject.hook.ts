import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, type Clip } from "@/modules/project";
import { selectionSubject, timelineRef } from "@/modules/timeline";
import { useVisibleLayers, type VisibleLayer } from "@/modules/transform";

/**
 * The one selected clip on a video track (a linked picture + sound counts as one), and its layer
 * when its picture is on screen at the playhead (the layer's transform includes a path's shift).
 */
export function useMaskSubject(): { clip: Clip | undefined; layer: VisibleLayer | undefined } {
  const project = useModule(projectRef).store;
  const selection = useStore(useModule(timelineRef).view, (s) => s.selection);
  const clip = useStore(project.api, (s) => {
    if (selectionSubject(s, selection) === undefined) return undefined;
    const id = selection.find((cid) => s.tracks[s.clips[cid]?.trackId ?? ""]?.kind === "video");
    return id === undefined ? undefined : s.clips[id];
  });
  const layers = useVisibleLayers();
  return { clip, layer: clip && layers.find((l) => l.clipId === clip.id) };
}
