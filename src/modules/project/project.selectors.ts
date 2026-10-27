import type { Micros } from "@/core";
import type { Clip, FormatPreset, ProjectFormat, ProjectState, Track } from "./project.types";

/** End time of a clip on the timeline. */
export function clipEnd(clip: Clip): Micros {
  return clip.start + clip.duration;
}

/** Length of the whole timeline: the end of the last clip. */
export function projectDuration(state: ProjectState): Micros {
  let end = 0;
  for (const clip of Object.values(state.clips)) end = Math.max(end, clipEnd(clip));
  return end;
}

/** Clips of a track, in timeline order. */
export function trackClips(state: ProjectState, track: Track): Clip[] {
  const clips: Clip[] = [];
  for (const id of track.clipIds) {
    const clip = state.clips[id];
    if (clip) clips.push(clip);
  }
  return clips;
}

/** Tracks in display order (top to bottom). */
export function orderedTracks(state: ProjectState): Track[] {
  const tracks: Track[] = [];
  for (const id of state.trackOrder) {
    const track = state.tracks[id];
    if (track) tracks.push(track);
  }
  return tracks;
}

/** Whether any clip uses the media. */
export function isMediaInUse(state: ProjectState, mediaId: string): boolean {
  return Object.values(state.clips).some(
    (clip) => clip.kind !== "text" && clip.mediaId === mediaId,
  );
}

/** The named preset a format matches by aspect ratio: square, landscape or vertical. */
export function formatPreset(format: ProjectFormat): FormatPreset {
  if (format.width === format.height) return "1:1";
  return format.width > format.height ? "16:9" : "9:16";
}
