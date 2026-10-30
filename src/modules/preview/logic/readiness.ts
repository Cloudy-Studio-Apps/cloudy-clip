import type { Clip } from "@/modules/project";

/**
 * Whether every visible clip that paints itself has its picture ready. Every clip is asked, even
 * after one says no, because asking is what starts its loading.
 */
export function picturesSettled(
  items: readonly { clip: Clip; hidden: boolean }[],
  readyOf: (clip: Clip) => boolean,
): boolean {
  let settled = true;
  for (const { clip, hidden } of items) {
    if (!hidden && !readyOf(clip)) settled = false;
  }
  return settled;
}
