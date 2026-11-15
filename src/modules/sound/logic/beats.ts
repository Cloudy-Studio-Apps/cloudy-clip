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

/** How far into the clip's played part a file time is, in file time (a reversed clip counts from the end). */
export function playedAt(clip: Clip, file: Micros): Micros {
  const span = sourceSpan(clip);
  return speedOf(clip).reversed ? clip.sourceIn + span - file : file - clip.sourceIn;
}

/**
 * Where a file time falls on the timeline under a clip, through its trims, speed, ramp and
 * reverse (`timeOfContent`). Times outside what the clip plays are brought to its ends; a held
 * frame plays nothing, so every time is its start.
 */
export function timelineTimeOf(clip: Clip, file: Micros): Micros {
  if (speedOf(clip).rate === 0) return clip.start;
  const played = Math.max(0, Math.min(playedAt(clip, file), sourceSpan(clip)));
  return timeOfContent(clip, (clip.animationOrigin ?? 0) + played);
}

/**
 * Where a file's beats (file microseconds) fall on the timeline under one clip: through its trims,
 * speed, ramp and reverse (`timeOfContent`), only those the clip plays. A held frame plays none.
 */
export function clipBeats(clip: Clip, beats: readonly Micros[]): Micros[] {
  if (speedOf(clip).rate === 0) return [];
  const span = sourceSpan(clip);
  const times: Micros[] = [];
  for (const beat of beats) {
    const played = playedAt(clip, beat);
    if (played >= 0 && played < span) times.push(timelineTimeOf(clip, beat));
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

/**
 * `compositionBeats` that answers again from its last result while the document, the composition
 * and the beats found are the same objects, so a drag asking per move doesn't scan and sort again.
 */
export function rememberedBeats(): typeof compositionBeats {
  let last: { args: Parameters<typeof compositionBeats>; times: Micros[] } | undefined;
  return (state, compositionId, files) => {
    if (last?.args[0] !== state || last.args[1] !== compositionId || last.args[2] !== files) {
      last = {
        args: [state, compositionId, files],
        times: compositionBeats(state, compositionId, files),
      };
    }
    return last.times;
  };
}
