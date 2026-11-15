import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { timeToPx, useFlagRow } from "@/modules/timeline";
import { compositionBeats } from "../../logic/beats";
import { soundRef } from "../../sound.ref";
import { useLanePage } from "./lane.page.hook";

/**
 * Thin ticks in the ruler (the marks row on the Sound page) at each beat found under the open
 * composition's audio clips (Find beats), only those near the viewport (`useLanePage`). Nothing
 * for a file with no beats. They take no pointer: drags snap to them, nothing more. Redraws on new
 * beats, an edit or a zoom, never per frame.
 */
export function BeatTicks() {
  const { beats } = useModule(soundRef);
  const project = useModule(projectRef).store.api;
  const compositionId = useOpenComposition()?.id;
  const { root, headerWidth, pxPerSecond, from, to } = useLanePage();
  const row = useFlagRow();
  const files = useStore(beats.state, (s) => s.files);
  const state = useStore(project, (s) => s);
  const times = useMemo(
    () => (compositionId ? compositionBeats(state, compositionId, files) : []),
    [state, compositionId, files],
  );
  // Only the ticks in the viewport and one either side are DOM nodes (rule 26).
  const seen = useMemo(
    () =>
      times.map((time) => timeToPx(time, pxPerSecond)).filter((left) => left >= from && left <= to),
    [times, pxPerSecond, from, to],
  );
  return (
    <div ref={root} className="pointer-events-none absolute inset-y-0 left-0 z-[34] w-0">
      <div className="sticky" style={{ top: row.top, marginTop: row.top, height: row.height }}>
        {seen.map((left, index) => (
          <div
            key={index}
            className="absolute bottom-0 h-1/2 w-px bg-on opacity-70"
            style={{ left: headerWidth + left }}
          />
        ))}
      </div>
    </div>
  );
}
