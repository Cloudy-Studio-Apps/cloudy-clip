import { Fragment, type RefObject } from "react";
import type { Micros, TimelineScopeName } from "@/core";
import type { TimelineLane } from "../timeline.types";
import { TrackHeader } from "./TrackHeader";
import { TrackInsert } from "./TrackInsert";
import { TrackLane } from "./TrackLane";

interface TimelineLanesProps {
  /** The listed tracks, each with only the clips of the rendered pages. */
  lanes: readonly TimelineLane[];
  scope: TimelineScopeName;
  contentWidth: number;
  pxPerSecond: number;
  from: Micros;
  to: Micros;
  rootRef: RefObject<HTMLDivElement | null>;
}

/** The rows of the timeline panel: an insert point, then a header and a lane for each track. */
export function TimelineLanes({
  lanes,
  scope,
  contentWidth,
  pxPerSecond,
  from,
  to,
  rootRef,
}: TimelineLanesProps) {
  return lanes.map(({ track, index, clips }, position) => (
    <Fragment key={track.id}>
      <TrackInsert index={index} above={lanes[position - 1]?.track.kind} below={track.kind} />
      <div className="flex">
        <TrackHeader track={track} code={scope === "sound" ? `A${position + 1}` : undefined} />
        <div style={{ width: contentWidth }}>
          <TrackLane
            track={track}
            clips={clips}
            pxPerSecond={pxPerSecond}
            from={from}
            to={to}
            rootRef={rootRef}
          />
        </div>
      </div>
    </Fragment>
  ));
}
