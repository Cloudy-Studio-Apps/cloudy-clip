import type { Micros } from "@/core";
import type { Clip, MediaId, ProjectState } from "@/modules/project";
import type { TrimEdge, TrimLimits } from "../timeline.types";
import { clampTrim, minClipDuration, neighbourBounds } from "./placement";

/** Length of a media file, if known. */
export type MediaDurationOf = (mediaId: MediaId) => Micros | undefined;

/** The limits a trim of `clip` is clamped to: source length, one frame, neighbours. */
export function trimLimits(
  state: ProjectState,
  clip: Clip,
  durationOf: MediaDurationOf,
): TrimLimits {
  const sourceless = clip.kind === "text";
  return {
    mediaDuration: (sourceless ? undefined : durationOf(clip.mediaId)) ?? Number.POSITIVE_INFINITY,
    minDuration: minClipDuration(state),
    ...neighbourBounds(state, clip),
    ...(sourceless && { sourceless }),
  };
}

/**
 * Where an edge of a linked group can go when dragged to `to`: each clip is clamped on its own,
 * and the tightest result wins (latest start, earliest end), so all keep the same edge.
 */
export function linkedTrimEdge(
  state: ProjectState,
  group: readonly Clip[],
  edge: TrimEdge,
  to: Micros,
  durationOf: MediaDurationOf,
): Micros {
  const edges = group.map((clip) => {
    const next = clampTrim(clip, edge, to, trimLimits(state, clip, durationOf));
    return edge === "start" ? next.start : next.start + next.duration;
  });
  return edge === "start" ? Math.max(...edges) : Math.min(...edges);
}
