import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { junctionRef } from "@/modules/junction";
import { projectRef, type ProjectState, type TrackId } from "@/modules/project";
import type { JunctionChipInfo } from "./timeline.types";

/**
 * The chips of a track's junctions, worked out once per project change with one selector: the
 * selector returns a string of what the chips show (stable while nothing visible changes), and
 * the list is rebuilt only when it changes. Sorted by time.
 */
export function useTrackChips(trackId: TrackId): JunctionChipInfo[] {
  const project = useModule(projectRef).store;
  const junctions = useModule(junctionRef);
  const key = useStore(project.api, (s: ProjectState) =>
    Object.values(s.junctions)
      .filter((j) => j.trackId === trackId)
      .map((j) => {
        const left = s.clips[j.leftClipId];
        const shown = junctions.display(j, s.format);
        return `${j.id}|${left ? left.start + left.duration : 0}|${j.duration}|${shown.label}|${shown.missing}`;
      })
      .join("\n"),
  );
  return useMemo(() => {
    void key;
    const state = project.getState();
    return Object.values(state.junctions)
      .filter((j) => j.trackId === trackId)
      .flatMap((junction) => {
        const left = state.clips[junction.leftClipId];
        if (!left) return [];
        const leftEnd = left.start + left.duration;
        const shown = junctions.display(junction, state.format);
        return [
          {
            junction,
            leftEnd,
            center: leftEnd - junction.duration / 2,
            label: shown.label,
            icon: shown.icon,
            missing: shown.missing,
          },
        ];
      })
      .sort((a, b) => a.center - b.center);
  }, [key, project, junctions, trackId]);
}
