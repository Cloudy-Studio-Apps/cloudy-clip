import type { Micros } from "@/core";
import type { ClipId } from "@/modules/project";

/**
 * What a split at the playhead cuts: the selected clips, or every clip under the playhead when
 * nothing is selected. The S key, the toolbar's Split and the Sound page's Cut all send this.
 */
export function playheadSplit(at: Micros, selection: readonly ClipId[]) {
  return { at, clipIds: selection.length > 0 ? [...selection] : undefined };
}
