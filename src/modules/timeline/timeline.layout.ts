import type { TimelineScopeName } from "@/core";
import type { TrackKind } from "@/modules/project";

/** Width of the track header column, in px. */
export const HEADER_WIDTH = 148;
/** Width of the track header column on a sound-scope timeline, in px. */
export const SOUND_HEADER_WIDTH = 164;
/** Height of the ruler, in px. */
export const RULER_HEIGHT = 28;
/** Height of the marks row under the ruler on a sound-scope timeline (markers, the loop), in px. */
export const MARKS_HEIGHT = 20;

/**
 * Height of the rows above the first lane, in px: the ruler, plus the marks row on a sound-scope
 * timeline. The one answer to where the lanes start.
 */
export function rowsAbove(scope: TimelineScopeName): number {
  return scope === "sound" ? RULER_HEIGHT + MARKS_HEIGHT : RULER_HEIGHT;
}
/** Pointer distance (px) within which edits snap to edges and the playhead. */
export const SNAP_PX = 8;
/** Pointer distance (px) within which something dragged over a lane snaps to a cut. */
export const CUT_SNAP_PX = 24;
/** Distance (px) from a clip edge that grabs the trim handle instead of moving the clip. */
export const TRIM_HANDLE_PX = 6;
/** Empty time kept after the last clip, so there is room to drop and drag (seconds). */
export const TAIL_SECONDS = 30;

/** Height of a track lane, in px. */
export function trackHeight(kind: TrackKind): number {
  return kind === "video" ? 64 : 44;
}

/** Narrowest a junction chip is drawn, in px, so a very short one stays clickable. */
export const JUNCTION_MIN_WIDTH_PX = 28;
