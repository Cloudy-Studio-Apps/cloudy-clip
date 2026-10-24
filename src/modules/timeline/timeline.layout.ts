import type { TrackKind } from "@/modules/project";

/** Width of the track header column, in px. */
export const HEADER_WIDTH = 148;
/** Height of the ruler, in px. */
export const RULER_HEIGHT = 28;
/** Pointer distance (px) within which edits snap to edges and the playhead. */
export const SNAP_PX = 8;
/** Distance (px) from a clip edge that grabs the trim handle instead of moving the clip. */
export const TRIM_HANDLE_PX = 6;
/** Empty time kept after the last clip, so there is room to drop and drag (seconds). */
export const TAIL_SECONDS = 30;

/** Height of a track lane, in px. */
export function trackHeight(kind: TrackKind): number {
  return kind === "video" ? 64 : 44;
}
