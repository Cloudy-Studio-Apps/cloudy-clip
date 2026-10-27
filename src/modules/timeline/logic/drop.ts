import type { Micros } from "@/core";
import type { DropTarget, LaneBox } from "../timeline.types";
import { pxToTime } from "./geometry";

/** The lane under a screen point and the time there (never before 0), or null. */
export function laneDropTarget(
  lanes: readonly LaneBox[],
  clientX: number,
  clientY: number,
  pxPerSecond: number,
): DropTarget | null {
  const lane = lanes.find((l) => clientY >= l.top && clientY < l.bottom);
  if (!lane) return null;
  const time: Micros = Math.max(0, pxToTime(clientX - lane.left, pxPerSecond));
  return { trackId: lane.trackId, time };
}
