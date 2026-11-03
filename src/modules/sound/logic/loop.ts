import type { Micros } from "@/core";
import { clipEnd, type ClipId, type ProjectState } from "@/modules/project";
import type { LoopRange } from "@/modules/preview";

/**
 * What the Loop button loops: the span of the selected clips, or the whole composition (of
 * `duration`) when none is selected.
 */
export function loopAround(
  state: ProjectState,
  selection: readonly ClipId[],
  duration: Micros,
): LoopRange {
  const clips = selection.flatMap((id) => state.clips[id] ?? []);
  if (clips.length === 0) return { from: 0, to: duration };
  return {
    from: Math.min(...clips.map((clip) => clip.start)),
    to: Math.max(...clips.map(clipEnd)),
  };
}
