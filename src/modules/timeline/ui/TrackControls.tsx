import { useMemo } from "react";
import { ErrorBoundary, usePoint } from "@/core";
import type { Track } from "@/modules/project";
import { inScope } from "../logic/scope";
import { timelineTrackControls } from "../timeline.points";
import { useTimelineScope } from "./scope.hook";

/** The controls modules put on a track's header (`timelineTrackControls`) in this scope, by `order`. */
export function TrackControls({ track }: { track: Track }) {
  const controls = usePoint(timelineTrackControls);
  const scope = useTimelineScope();
  const ordered = useMemo(
    () => controls.filter((c) => inScope(c, scope)).sort((a, b) => a.order - b.order),
    [controls, scope],
  );
  return ordered.map(({ id, component: Control }) => (
    <ErrorBoundary key={id} name={id}>
      <Control track={track} />
    </ErrorBoundary>
  ));
}
