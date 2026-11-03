import { MICROS_PER_SECOND, type Micros } from "@/core";
import { timeOfContent, type Clip, type KeyTrack } from "@/modules/project";
import type { WindowKey } from "../keyframe.types";

/**
 * The keys of a track whose timeline time falls in `from..to`, with that time. `inside` is false
 * for a key outside the clip's own span, which still shapes the curve.
 */
export function keysInWindow(track: KeyTrack, clip: Clip, from: Micros, to: Micros): WindowKey[] {
  const end = clip.start + clip.duration;
  return track.keys.flatMap((key) => {
    const time = timeOfContent(clip, key.t);
    if (time < from || time > to) return [];
    return [{ key, time, inside: time >= clip.start && time < end }];
  });
}

/** The span of the page the view is on and the one on each side (rule 26: pages as wide as the view). */
export function pagesSpan(
  scrollLeft: number,
  pageWidth: number,
  pxPerSecond: number,
): { from: Micros; to: Micros } {
  const page = Math.floor(scrollLeft / pageWidth);
  const at = (px: number): Micros => Math.round((px / pxPerSecond) * MICROS_PER_SECOND);
  return { from: Math.max(0, at((page - 1) * pageWidth)), to: at((page + 2) * pageWidth) };
}

/** The distinct times of a clip's keys in a window, in order: the summary row's diamonds. */
export function summaryTimes(keys: readonly { time: Micros }[]): Micros[] {
  return [...new Set(keys.map((k) => k.time))].sort((a, b) => a - b);
}
