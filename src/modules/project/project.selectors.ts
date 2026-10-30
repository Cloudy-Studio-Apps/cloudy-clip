import type { Micros } from "@/core";
import { DEFAULT_FORMAT } from "./project.store";
import type {
  Clip,
  Composition,
  CompositionId,
  ProjectFormat,
  ProjectState,
  Track,
  TrackId,
} from "./project.types";

/** End time of a clip on the timeline. */
export function clipEnd(clip: Clip): Micros {
  return clip.start + clip.duration;
}

/** Length of one frame; never rounds to less, so a frame of time always holds a frame. */
export function frameDuration(format: ProjectFormat): Micros {
  return Math.ceil(1_000_000 / format.fps);
}

/** The composition a track belongs to. */
export function compositionOf(state: ProjectState, track: Track): Composition {
  const composition = state.compositions[track.compositionId];
  if (!composition) throw new Error(`Track "${track.id}" has no composition`);
  return composition;
}

/** Format of the composition a track belongs to. */
export function formatOfTrack(state: ProjectState, trackId: TrackId): ProjectFormat {
  const track = state.tracks[trackId];
  return (track && state.compositions[track.compositionId]?.format) ?? DEFAULT_FORMAT;
}

/** Format of the composition a clip sits in. */
export function formatOf(state: ProjectState, clip: Clip): ProjectFormat {
  return formatOfTrack(state, clip.trackId);
}

/** Clips of one composition, track by track. */
export function compositionClips(state: ProjectState, compositionId: CompositionId): Clip[] {
  return orderedTracks(state, compositionId).flatMap((track) => trackClips(state, track));
}

/** Where a composition's content ends: the end of its last clip. */
export function compositionContent(state: ProjectState, compositionId: CompositionId): Micros {
  let end = 0;
  for (const clip of compositionClips(state, compositionId)) end = Math.max(end, clipEnd(clip));
  return end;
}

/** Clips that play a composition, wherever they sit. */
export function placementsOf(state: ProjectState, compositionId: CompositionId): Clip[] {
  return Object.values(state.clips).filter((clip) => clip.compositionRef === compositionId);
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

/** A composition's tracks in display order (top to bottom). */
export function orderedTracks(state: ProjectState, compositionId: CompositionId): Track[] {
  const tracks: Track[] = [];
  for (const id of state.compositions[compositionId]?.trackOrder ?? []) {
    const track = state.tracks[id];
    if (track) tracks.push(track);
  }
  return tracks;
}

/**
 * Whether a clip plays its file's time, so its length is bounded by it and `sourceIn` moves when
 * trimmed or split. Images and elements without a file have no time of their own.
 */
export function followsFileTime(state: Pick<ProjectState, "media">, clip: Clip): boolean {
  if (clip.compositionRef !== undefined) return true;
  if (clip.mediaId === undefined) return false;
  return state.media[clip.mediaId]?.kind !== "image";
}

/** Whether any clip uses the media. */
export function isMediaInUse(state: ProjectState, mediaId: string): boolean {
  return Object.values(state.clips).some((clip) => clip.mediaId === mediaId);
}
