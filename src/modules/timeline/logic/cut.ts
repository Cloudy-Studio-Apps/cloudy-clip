import { cutNear, type Cut } from "@/modules/junction";
import type { ProjectState, TrackId } from "@/modules/project";
import { pxToTime } from "./geometry";

/**
 * The cut (two clips touching, or overlapping by their junction) on a track within
 * `tolerancePx` of a lane x coordinate (0 is time 0), or undefined.
 */
export function cutAtX(
  state: ProjectState,
  trackId: TrackId,
  x: number,
  pxPerSecond: number,
  tolerancePx: number,
): Cut | undefined {
  return cutNear(state, trackId, pxToTime(x, pxPerSecond), pxToTime(tolerancePx, pxPerSecond));
}
