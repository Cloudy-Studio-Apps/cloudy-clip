import { useMemo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { seek } from "@/modules/preview";
import { projectRef, useOpenComposition } from "@/modules/project";
import { timelineRef, timeToPx, useFlagRow, useHeaderWidth } from "@/modules/timeline";
import { groupProblems, spotTime } from "../../logic/problems";
import { soundRef } from "../../sound.ref";

/**
 * Red ticks in the ruler (the marks row on the Sound page) at each spot the last analysis of the
 * open composition found: peaks over the limit and clipping, a tick as wide as the stretch (at
 * least 2 px). A click seeks the user's playhead there. After an edit they stay, dimmed, until the
 * mix is analyzed again. Redraws on a new analysis, an edit or a zoom, never per frame.
 */
export function ProblemMarks() {
  const { bus } = useKernel();
  const { analyzer } = useModule(soundRef);
  const project = useModule(projectRef).store.api;
  const timeline = useModule(timelineRef);
  const compositionId = useOpenComposition()?.id;
  const headerWidth = useHeaderWidth();
  const row = useFlagRow();
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const stored = useStore(analyzer.state, (s) =>
    compositionId ? s.results[compositionId] : undefined,
  );
  const stale = useStore(project, (s) => (stored ? s !== stored.measured : false));
  const spots = useMemo(() => groupProblems(stored?.result.problems ?? []), [stored]);
  if (spots.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 z-[35] w-0"
      style={{ opacity: stale ? 0.5 : 1 }}
    >
      <div className="sticky" style={{ top: row.top, marginTop: row.top, height: row.height }}>
        {spots.map((spot) => (
          <button
            key={`${spot.at}-${spot.kind}`}
            type="button"
            title={`${spotTime(spot.at)} ${spot.kind === "clipped" ? "Clipped" : "Peak high"}`}
            aria-label={`Problem at ${spotTime(spot.at)}`}
            // The ruler under the tick would scrub.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => void bus.run(seek, { time: spot.at })}
            className="pointer-events-auto absolute top-0 h-full min-w-0.5 cursor-pointer bg-mark"
            style={{
              left: headerWidth + timeToPx(spot.at, pxPerSecond),
              width: Math.max(2, timeToPx(spot.duration, pxPerSecond)),
            }}
          />
        ))}
      </div>
    </div>
  );
}
