import type { Micros } from "@/core";
import {
  canGrade,
  clipEnd,
  orderedTracks,
  trackClips,
  type ClipId,
  type CompositionId,
  type ProjectState,
} from "@/modules/project";
import type { StripClip } from "../tint.types";

/**
 * The clips the strip lists: every gradeable clip of the composition's video tracks, by start.
 * Tracks are tagged `V1`, `V2`… from the top of the timeline down; clips starting together keep
 * their track order.
 */
export function stripClips(project: ProjectState, compositionId: CompositionId): StripClip[] {
  const found: Omit<StripClip, "no">[] = [];
  orderedTracks(project, compositionId)
    .filter((track) => track.kind === "video")
    .forEach((track, index) => {
      for (const clip of trackClips(project, track)) {
        if (canGrade(clip, project)) found.push({ clip, track: `V${index + 1}` });
      }
    });
  found.sort((a, b) => a.clip.start - b.clip.start);
  return found.map((entry, index) => ({ ...entry, no: String(index + 1).padStart(2, "0") }));
}

/** The gradeable clip seen at `time`: the one on the topmost video track that isn't hidden. */
export function clipUnder(
  project: ProjectState,
  compositionId: CompositionId,
  time: Micros,
): ClipId | null {
  for (const track of orderedTracks(project, compositionId)) {
    if (track.kind !== "video" || track.hidden) continue;
    for (const clip of trackClips(project, track)) {
      if (clip.start > time) break;
      if (!clip.disabled && time < clipEnd(clip) && canGrade(clip, project)) return clip.id;
    }
  }
  return null;
}

/** Whether `clipId` is a gradeable clip of the composition with `time` inside it. */
export function holdsTime(
  project: ProjectState,
  compositionId: CompositionId,
  clipId: ClipId,
  time: Micros,
): boolean {
  const clip = project.clips[clipId];
  const track = clip && project.tracks[clip.trackId];
  if (!clip || track?.compositionId !== compositionId) return false;
  return canGrade(clip, project) && clip.start <= time && time < clipEnd(clip);
}

/** Where a click on a clip puts the playhead: where it was last, else the middle of the clip. */
export function landingTime(clip: StripClip["clip"], viewed: Micros | undefined): Micros {
  if (viewed !== undefined && clip.start <= viewed && viewed < clipEnd(clip)) return viewed;
  return clip.start + Math.floor(clip.duration / 2);
}

/** The clip before (`-1`) or after (`1`) `from` in the strip; with no current clip, the first or the last. */
export function neighbourClip(
  strip: readonly StripClip[],
  from: ClipId | null,
  by: -1 | 1,
): StripClip | undefined {
  const here = strip.findIndex((entry) => entry.clip.id === from);
  return strip[here < 0 ? (by > 0 ? 0 : strip.length - 1) : here + by];
}

/** `m:ss` of a time, for the strip and the overview. */
export function shortTime(time: Micros): string {
  const seconds = Math.floor(time / 1_000_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
