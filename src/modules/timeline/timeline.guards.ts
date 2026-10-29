import { z } from "zod";
import { CommandFailure, formatTimecode, type Micros } from "@/core";
import type { MediaApi } from "@/modules/media";
import {
  findLayoutConflict,
  type Clip,
  type ClipId,
  type ProjectState,
  type Track,
} from "@/modules/project";

/** Input schema for a time on the timeline. */
export const time = z.number().int().min(0).describe("Microseconds");

/** The clip, or a `timeline.clip_not_found` failure. */
export function requireClip(state: ProjectState, clipId: string): Clip {
  const clip = state.clips[clipId];
  if (!clip) throw new CommandFailure("timeline.clip_not_found", `No clip with id "${clipId}"`);
  return clip;
}

/** The track, or a `timeline.track_not_found` failure. */
export function requireTrack(state: ProjectState, trackId: string): Track {
  const track = state.tracks[trackId];
  if (!track) throw new CommandFailure("timeline.track_not_found", `No track with id "${trackId}"`);
  return track;
}

/** Length of a media file, or a failure explaining why it can't be placed yet. */
export function mediaDuration(media: MediaApi, mediaId: string): Micros {
  const probe = media.getProbe(mediaId);
  if (probe?.status === "error") {
    throw new CommandFailure("media.unsupported", probe.error ?? "This media cannot be played");
  }
  if (probe?.status !== "ready" || probe.duration === undefined) {
    const proxy = probe?.proxy;
    const preparing =
      proxy && (proxy.state === "queued" || proxy.state === "encoding")
        ? ` It is being optimized for editing (${Math.round((proxy.progress ?? 0) * 100)}%).`
        : "";
    throw new CommandFailure(
      "media.not_ready",
      `This media is still loading.${preparing} Try again shortly.`,
    );
  }
  return probe.duration;
}

/** The failure for a spot that overlaps `other`, with where it is. */
export function overlapError(state: ProjectState, other: Clip): CommandFailure {
  const end = other.start + other.duration;
  return new CommandFailure(
    "timeline.overlap",
    `That spot overlaps clip "${other.id}" (${formatTimecode(other.start)}–${formatTimecode(end)}) on track "${state.tracks[other.trackId]?.name}". Pick a free spot or another track.`,
    { clipId: other.id, start: other.start, end },
  );
}

/**
 * Fails when `next` has clips overlapping where no junction allows it (`timeline.overlap`, naming
 * the clip in the way: the one the edit didn't move) or starting before 0
 * (`timeline.out_of_range`). Spec rule 12.
 */
export function checkLayout(next: ProjectState, moved: ReadonlySet<ClipId>): void {
  const conflict = findLayoutConflict(next);
  if (!conflict) return;
  if (conflict.clip === conflict.other) {
    throw new CommandFailure(
      "timeline.out_of_range",
      "A clip would start before the beginning of the timeline",
    );
  }
  throw overlapError(next, moved.has(conflict.clip.id) ? conflict.other : conflict.clip);
}
