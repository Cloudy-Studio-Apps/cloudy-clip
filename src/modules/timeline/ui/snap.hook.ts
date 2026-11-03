import { useCallback } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { snapCandidates } from "../logic/placement";
import { timelineSnapTargets } from "../timeline.points";
import { timelineRef } from "../timeline.ref";
import type { SnapCandidates } from "../timeline.types";
import { useTimelineScope } from "./scope.hook";

/**
 * What drags snap to: clip edges, cuts and the playhead, plus every module's snap targets. Nothing
 * while snapping is off for the panel's scope (`view.unsnapped`).
 */
export function useSnapCandidates(): SnapCandidates {
  const targets = usePoint(timelineSnapTargets);
  const scope = useTimelineScope();
  const snaps = useStore(useModule(timelineRef).view, (s) => !s.unsnapped.includes(scope));
  return useCallback(
    (state, compositionId, playhead, ignore) =>
      snaps
        ? [
            ...snapCandidates(state, compositionId, playhead, ignore),
            ...targets.flatMap((target) => target.times(state, compositionId)),
          ]
        : [],
    [targets, snaps],
  );
}
