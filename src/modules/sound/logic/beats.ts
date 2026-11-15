import type { Micros } from "@/core";
import {
  compositionClips,
  sourceSpan,
  speedOf,
  timeOfContent,
  type Clip,
  type CompositionId,
  type ProjectState,
} from "@/modules/project";

/**
 * Where a file's beats (file microseconds) fall on the timeline under one clip: through its trims,
 * speed, ramp and reverse (`timeOfContent`), only those the clip plays. A held frame plays none.
 */
export function clipBeats(clip: Clip, beats: readonly Micros[]): Micros[] {
  const { rate, reversed } = speedOf(clip);
  if (rate === 0) return [];
  const span = sourceSpan(clip);
  const origin = clip.animationOrigin ?? 0;
  const times: Micros[] = [];
  for (const beat of beats) {
    const played = reversed ? clip.sourceIn + span - beat : beat - clip.sourceIn;
    if (played >= 0 && played < span) times.push(timeOfContent(clip, origin + played));
  }
  return times;
}

/** The beats found for the files of a composition's clips on audio tracks, in timeline time, in order. */
export function compositionBeats(
  state: ProjectState,
  compositionId: CompositionId,
  files: Record<string, Micros[]>,
): Micros[] {
  const times: Micros[] = [];
  for (const clip of compositionClips(state, compositionId)) {
    if (state.tracks[clip.trackId]?.kind !== "audio" || clip.mediaId === undefined) continue;
    const beats = files[state.media[clip.mediaId]?.path ?? ""];
    if (beats) times.push(...clipBeats(clip, beats));
  }
  return times.sort((a, b) => a - b);
}
