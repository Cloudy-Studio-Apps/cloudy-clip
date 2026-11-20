import {
  orderedMasks,
  type Clip,
  type ClipMask,
  type Composition,
  type MaskId,
  type ProjectState,
  type TrackId,
} from "@/modules/project";

/** A clip's enabled masks in order, with a drag's live values (`previewProps`' `masks`) over them. */
export function liveMasks(
  clip: Clip,
  live: Record<MaskId, Partial<ClipMask>> | undefined,
): ClipMask[] {
  return orderedMasks(clip).flatMap((mask) => {
    const patch = live?.[mask.id];
    const merged = patch
      ? ({ ...mask, ...patch, shape: { ...mask.shape, ...patch.shape } } as ClipMask)
      : mask;
    return merged.on === false ? [] : [merged];
  });
}

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
      named.set(target, [...(named.get(target) ?? []), trackId]);
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
