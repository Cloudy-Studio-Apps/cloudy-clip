import type { Micros } from "@/core";
import { durationLimits, type Cut, type JunctionKindDefinition } from "@/modules/junction";
import {
  applyMoves,
  findLayoutConflict,
  junctionBetween,
  rippleMoves,
  type ClipId,
  type ProjectState,
} from "@/modules/project";

/**
 * What applying a transition to a cut would do, without doing it: the overlap it would have and
 * whether the cut can take it, and how far each clip would move (`shifts`, empty when nothing
 * would). A transition already on the cut keeps its duration and moves nothing.
 */
export function previewOnCut(
  state: ProjectState,
  kind: JunctionKindDefinition,
  cut: Cut,
): { duration: Micros; fits: boolean; shifts: Record<ClipId, Micros> } {
  const existing = junctionBetween(state, cut.left.id, cut.right.id);
  if (existing) {
    return { duration: existing.duration, fits: existing.kind === kind.kind, shifts: {} };
  }
  const { min, max, default: duration } = durationLimits(kind, state, cut.left, cut.right);
  if (max < min) return { duration, fits: false, shifts: {} };
  const moves = rippleMoves(state, cut.right.id, -duration);
  const next = applyMoves(state, moves, {
    preview: {
      id: "preview",
      kind: kind.kind,
      trackId: cut.trackId,
      leftClipId: cut.left.id,
      rightClipId: cut.right.id,
      duration,
      props: {},
    },
  });
  if (findLayoutConflict(next)) return { duration, fits: false, shifts: {} };
  return {
    duration,
    fits: true,
    shifts: Object.fromEntries(moves.map((m) => [m.clipId, -duration])),
  };
}
