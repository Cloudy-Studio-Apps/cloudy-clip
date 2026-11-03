import { MARKS_HEIGHT, RULER_HEIGHT } from "../timeline.layout";
import type { FlagRow } from "../timeline.types";
import { useTimelineScope } from "./scope.hook";

const ON_RULER: FlagRow = { top: 0, height: RULER_HEIGHT };
const ON_MARKS: FlagRow = { top: RULER_HEIGHT, height: MARKS_HEIGHT };

/**
 * Where flags go in the panel this component sits in, in px from the top of the timeline's content:
 * the ruler on the editor's timeline, the marks row under it on a sound-scope one. An overlay
 * that draws a flag or a mark in time (markers, later problem marks and beat ticks) places itself
 * with it, so no module checks the page.
 */
export function useFlagRow(): FlagRow {
  return useTimelineScope() === "sound" ? ON_MARKS : ON_RULER;
}
