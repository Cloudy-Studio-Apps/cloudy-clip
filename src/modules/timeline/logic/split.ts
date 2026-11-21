import type { Micros, TimelineScopeName } from "@/core";
import {
  compositionClips,
  type ClipId,
  type CompositionId,
  type ProjectState,
} from "@/modules/project";
import { clipInScope, clipsInScope } from "./scope";

/**
 * What a split at the playhead cuts: the selected clips, or every clip under the playhead when
 * nothing is selected. On the `"subtitle"` scope only cues: the selected ones, else the ones under
 * the playhead in the open composition, else nothing (null), since the selection is shared with
 * the Edit page. The S key, the toolbar's Split and the clip menu's Split all send this.
 */
export function playheadSplit(
  state: ProjectState,
  at: Micros,
  selection: readonly ClipId[],
  scope: TimelineScopeName,
  compositionId: CompositionId | null,
): { at: Micros; clipIds?: ClipId[] } | null {
  if (scope !== "subtitle")
    return { at, clipIds: selection.length > 0 ? [...selection] : undefined };
  const picked = selection.filter((id) => {
    const clip = state.clips[id];
    return clip !== undefined && clipInScope(clip, scope);
  });
  if (picked.length > 0) return { at, clipIds: picked };
  const under = compositionId
    ? clipsInScope(state, compositionClips(state, compositionId), scope)
        .filter((clip) => at > clip.start && at < clip.start + clip.duration)
        .map((clip) => clip.id)
    : [];
  return under.length > 0 ? { at, clipIds: under } : null;
}
