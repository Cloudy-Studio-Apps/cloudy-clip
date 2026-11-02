import type { Micros } from "@/core";
import type { Clip, CompositionId, ProjectState, Track, TrackKind } from "@/modules/project";
import type {
  FrameOptions,
  ResolvedClip,
  ResolvedFrame,
  ResolvedTrack,
  UpcomingClip,
} from "../engine/engine.types";

const pathOf = (prefix: string, clipId: string) => (prefix ? `${prefix}/${clipId}` : clipId);

/** Clock of a composition clip's composition when its own clock reads `time`. */
const localTime = (clip: Clip, time: Micros) => clip.sourceIn + time - clip.start;

/** What a placement shows at its local time: sound from a sound clip, pictures from a picture. */
function inside(
  project: ProjectState,
  clip: Clip,
  track: Track,
  time: Micros,
  options: FrameOptions,
  prefix: string,
): ResolvedFrame | undefined {
  if (clip.compositionRef === undefined) return undefined;
  if (track.kind === "video" && track.hidden) return undefined;
  const local = localTime(clip, time);
  return resolveLevel(project, clip.compositionRef, local, options, prefix, track.kind);
}

/** Every media clip showing in a frame, as things to prepare ahead. */
function showing({ tracks }: ResolvedFrame): UpcomingClip[] {
  return tracks.flatMap(({ track, clips }) =>
    clips.flatMap(({ clip, path, time, inner }) =>
      inner ? showing(inner) : [{ path, clip, track, time }],
    ),
  );
}

function resolveLevel(
  project: ProjectState,
  compositionId: CompositionId,
  time: Micros,
  options: FrameOptions,
  prefix: string,
  only: TrackKind | null,
): ResolvedFrame | undefined {
  const composition = project.compositions[compositionId];
  if (!composition) return undefined;
  const tracks: ResolvedTrack[] = [];
  const upcoming: UpcomingClip[] = [];
  const ended = time >= composition.duration;
  for (const trackId of composition.trackOrder) {
    const track = project.tracks[trackId];
    if (!track || (only !== null && track.kind !== only)) continue;
    if (options.pictureOnly && track.kind !== "video") continue;
    const clips: ResolvedClip[] = [];
    tracks.push({ track, clips });
    if (ended) continue;
    for (const clipId of track.clipIds) {
      const clip = project.clips[clipId];
      if (!clip || clip.disabled) continue;
      const path = pathOf(prefix, clip.id);
      if (clip.start <= time && time < clip.start + clip.duration) {
        const inner = inside(project, clip, track, time, options, path);
        clips.push({ clip, path, time, ...(inner && { inner }) });
        if (inner) upcoming.push(...inner.upcoming);
      } else if (clip.start > time && clip.start - time <= options.preloadAhead) {
        const inner = inside(project, clip, track, clip.start, options, path);
        if (inner) upcoming.push(...showing(inner));
        else upcoming.push({ path, clip, track, time: clip.start });
      } else if (clip.start > time + options.preloadAhead) break; // clips are sorted by start
    }
  }
  return { composition, time, tracks, upcoming };
}

/**
 * A composition at a time, as a tree: its tracks, the clips under `time` on each, and inside each
 * placement what its own composition shows at its local time. Every clip has a path of placement
 * ids, because one original can be on screen twice and a clip id no longer says which.
 */
export function resolveFrame(
  project: ProjectState,
  compositionId: CompositionId,
  time: Micros,
  options: FrameOptions,
): ResolvedFrame {
  const frame = resolveLevel(project, compositionId, time, options, "", null);
  if (!frame) throw new Error(`No composition "${compositionId}"`);
  return frame;
}
