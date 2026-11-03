import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { compositionMarkers, projectRef, useOpenComposition } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { MarkerFlag } from "./MarkerFlag";

/** The open composition's markers, as flags in the ruler. Redraws on marker or zoom changes only. */
export function MarkerFlags() {
  const project = useModule(projectRef).store.api;
  const timeline = useModule(timelineRef);
  const compositionId = useOpenComposition()?.id;
  const markers = useStore(project, (s) => s.markers);
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const shown = useMemo(
    () => (compositionId ? compositionMarkers({ markers }, compositionId) : []),
    [markers, compositionId],
  );
  return (
    <>
      {shown.map((marker) => (
        <MarkerFlag key={marker.id} marker={marker} pxPerSecond={pxPerSecond} />
      ))}
    </>
  );
}
