import type { Micros } from "@/core";
import { durationLimits } from "@/modules/junction";
import {
  allowedOverlap,
  junctionBetween,
  partnersOf,
  type Clip,
  type Junction,
  type ProjectState,
} from "@/modules/project";
import type { JunctionKindOf } from "../timeline.types";

/** The junction that allows `left` and `right` to overlap: their own, or their partners' (junction rule 4). */
function governingJunction(state: ProjectState, left: Clip, right: Clip): Junction | undefined {
  const own = junctionBetween(state, left.id, right.id);
  if (own) return own;
  const rightPartners = partnersOf(state, right.id);
  for (const pl of partnersOf(state, left.id)) {
    for (const pr of rightPartners) {
      const linked = junctionBetween(state, pl.id, pr.id);
      if (linked) return linked;
    }
  }
  return undefined;
}

/**
 * Whether `left` and `right` (same track, `left` first) may overlap by `overlap` after a move,
 * the way `timeline.moveClip` decides: the current junction duration, or any overlap within the
 * kind's `durationLimits` (the command then updates the junction); a kind no module registers
 * accepts any positive overlap. With no junction it is false.
 */
export function overlapAccepted(
  state: ProjectState,
  left: Clip,
  right: Clip,
  overlap: Micros,
  kindOf: JunctionKindOf,
): boolean {
  if (overlap === allowedOverlap(state, left, right)) return true;
  const junction = governingJunction(state, left, right);
  if (!junction || overlap <= 0) return false;
  const kind = kindOf(junction.kind);
  if (!kind) return true;
  const jl = state.clips[junction.leftClipId];
  const jr = state.clips[junction.rightClipId];
  if (!jl || !jr) return false;
  const limits = durationLimits(kind, state, jl, jr);
  return overlap >= limits.min && overlap <= limits.max;
}
