import type { Draft } from "immer";
import { clipEnd, compositionClips, frameDuration } from "../project.selectors";
import type { CompositionId, ProjectState } from "../project.types";

/** Whether `inner` is `outer`, or placed inside it at any depth. */
export function contains(
  state: ProjectState,
  outer: CompositionId,
  inner: CompositionId,
  seen: Set<CompositionId> = new Set(),
): boolean {
  if (outer === inner) return true;
  if (seen.has(outer)) return false;
  seen.add(outer);
  return compositionClips(state, outer).some(
    (clip) =>
      clip.compositionRef !== undefined && contains(state, clip.compositionRef, inner, seen),
  );
}

/** Keeps every Extend to fit composition as long as its content (one frame when it has none). */
export function settleCompositions(draft: Draft<ProjectState>): void {
  const state = draft as ProjectState;
  for (const composition of Object.values(state.compositions)) {
    if (!composition.extendToFit) continue;
    let end = 0;
    for (const clip of compositionClips(state, composition.id)) end = Math.max(end, clipEnd(clip));
    composition.duration = Math.max(end, frameDuration(composition.format));
  }
}
