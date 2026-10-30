import type { Draft } from "immer";
import type { Micros } from "@/core";
import { clipEnd, compositionClips, frameDuration } from "../project.selectors";
import type { Clip, ClipId, Composition, CompositionId, ProjectState } from "../project.types";
import { partnersOf } from "./links";

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

/** Every composition after the ones placed inside it. */
function innermostFirst(state: ProjectState): Composition[] {
  const order: Composition[] = [];
  const seen = new Set<CompositionId>();
  const visit = (id: CompositionId) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const clip of compositionClips(state, id)) {
      if (clip.compositionRef !== undefined) visit(clip.compositionRef);
    }
    const composition = state.compositions[id];
    if (composition) order.push(composition);
  };
  for (const id of Object.keys(state.compositions)) visit(id);
  return order;
}

/** Fits a placement to what its composition plays now. Returns whether it changed. */
function fitPlacement(clip: Clip, length: Micros, frame: Micros): boolean {
  const { sourceIn, duration } = clip;
  if (clip.sourceIn >= length) clip.sourceIn = Math.max(0, length - frame);
  clip.duration = Math.min(clip.duration, length - clip.sourceIn);
  return clip.sourceIn !== sourceIn || clip.duration !== duration;
}

/** Ends `left` where `right` starts, if it runs past it. */
function endAt(left: Clip, right: Clip): void {
  if (clipEnd(left) > right.start) left.duration = right.start - left.start;
}

/**
 * A shortened clip no longer meets its neighbour under a transition: the transition goes, and the
 * clip (with its linked sound) ends where the next one starts, so no overlap is left behind and
 * nothing to the right moves.
 */
function dropBrokenJunctions(state: ProjectState, shortened: ReadonlySet<ClipId>): void {
  for (const junction of Object.values(state.junctions)) {
    if (!shortened.has(junction.leftClipId)) continue;
    const left = state.clips[junction.leftClipId];
    const right = state.clips[junction.rightClipId];
    if (!left || !right || clipEnd(left) - right.start === junction.duration) continue;
    const partners = partnersOf(state, left.id);
    const rightPartners = partnersOf(state, right.id);
    delete state.junctions[junction.id];
    endAt(left, right);
    for (const partner of partners) {
      const next = rightPartners.find((clip) => clip.trackId === partner.trackId);
      if (next) endAt(partner, next);
    }
  }
}

/**
 * Keeps what follows from a composition's length true inside every step, innermost first: its
 * placements fit what it plays, and with Extend to fit it is as long as its content (one frame
 * when it has none).
 */
export function settleCompositions(draft: Draft<ProjectState>): void {
  const state = draft as ProjectState;
  for (const composition of innermostFirst(state)) {
    const frame = frameDuration(composition.format);
    const shortened = new Set<ClipId>();
    for (const clip of compositionClips(state, composition.id)) {
      const placed = clip.compositionRef && state.compositions[clip.compositionRef];
      if (placed && fitPlacement(clip, placed.duration, frame)) shortened.add(clip.id);
    }
    if (shortened.size > 0) dropBrokenJunctions(state, shortened);
    if (!composition.extendToFit) continue;
    const end = compositionClips(state, composition.id).reduce(
      (latest, clip) => Math.max(latest, clipEnd(clip)),
      0,
    );
    composition.duration = Math.max(end, frame);
  }
}
