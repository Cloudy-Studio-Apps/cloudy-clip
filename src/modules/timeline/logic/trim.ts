import type { Micros } from "@/core";
import { formatOf, type Clip, type MediaId, type ProjectState } from "@/modules/project";
import type { TrimEdge, TrimLimits } from "../timeline.types";
import { clampTrim, minClipDuration, neighbourBounds } from "./placement";

/** Length of a media file, if known. */
export type MediaDurationOf = (mediaId: MediaId) => Micros | undefined;

/**
 * The limits a trim of `clip` is clamped to: source length, one frame, neighbours. Given the
 * `edge` being trimmed, a neighbour joined to the clip on that edge is no limit: it ripples.
 */
export function trimLimits(
  state: ProjectState,
  clip: Clip,
  durationOf: MediaDurationOf,
  edge?: TrimEdge,
): TrimLimits {
  // Elements without a source file (text) have no media.
  const sourceless = clip.mediaId === undefined;
  return {
    mediaDuration:
      (sourceless || !clip.mediaId ? undefined : durationOf(clip.mediaId)) ??
      Number.POSITIVE_INFINITY,
    minDuration: minClipDuration(formatOf(state, clip)),
    ...neighbourBounds(state, clip, edge),
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
    const next = clampTrim(clip, edge, to, trimLimits(state, clip, durationOf, edge));
    return edge === "start" ? next.start : next.start + next.duration;
  });
  return edge === "start" ? Math.max(...edges) : Math.min(...edges);
}
