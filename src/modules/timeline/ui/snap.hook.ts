import { useCallback } from "react";
import { usePoint } from "@/core";
import { snapCandidates } from "../logic/placement";
import { timelineSnapTargets } from "../timeline.points";
import type { SnapCandidates } from "../timeline.types";

/** What drags snap to: clip edges, cuts and the playhead, plus every module's snap targets. */
export function useSnapCandidates(): SnapCandidates {
  const targets = usePoint(timelineSnapTargets);
  return useCallback(
    (state, compositionId, playhead, ignore) => [
      ...snapCandidates(state, compositionId, playhead, ignore),
      ...targets.flatMap((target) => target.times(state, compositionId)),
    ],
    [targets],
  );
}
