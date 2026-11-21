import type { Clip, Composition, ProjectState, TrackId } from "../project.types";

/**
 * The video tracks of a composition that are mattes: named by a clip's `matte` (any clip, shown
 * now or not), not its own track, and from a track no other clip names (no chains). They never
 * draw themselves.
 */
export function matteTracks(project: ProjectState, composition: Composition): Set<TrackId> {
  const named = new Map<TrackId, TrackId[]>();
  for (const trackId of composition.trackOrder) {
    const track = project.tracks[trackId];
    if (track?.kind !== "video") continue;
    for (const clipId of track.clipIds) {
      const target = project.clips[clipId]?.matte?.trackId;
      if (target === undefined || target === trackId) continue;
      if (project.tracks[target]?.kind !== "video") continue;
      const from = named.get(target);
      if (from) from.push(trackId);
      else named.set(target, [trackId]);
    }
  }
  const mattes = new Set<TrackId>();
  for (const [target, from] of named) {
    if (from.some((trackId) => !named.has(trackId))) mattes.add(target);
  }
  return mattes;
}

/** The track a clip is matted by, when its matte counts (see `matteTracks`); else null. */
export function usableMatte(clip: Clip, mattes: ReadonlySet<TrackId>): TrackId | null {
  const target = clip.matte?.trackId;
  if (target === undefined || mattes.has(clip.trackId) || !mattes.has(target)) return null;
  return target;
}
