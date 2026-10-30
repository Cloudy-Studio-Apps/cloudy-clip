import { microsToSeconds, type Micros } from "@/core";
import {
  allowedOverlap,
  type ClipId,
  type Composition,
  type ProjectState,
  type TrackId,
} from "@/modules/project";
import type { ActiveJunction } from "../preview.types";

/** Overlapping junctions under `time` on a track: progress = (time - right.start) / duration. */
export function activeJunctions(
  project: ProjectState,
  trackId: TrackId,
  time: Micros,
): ActiveJunction[] {
  const result: ActiveJunction[] = [];
  for (const junction of Object.values(project.junctions)) {
    if (junction.trackId !== trackId || junction.duration <= 0) continue;
    const right = project.clips[junction.rightClipId];
    if (!right) continue;
    const since = time - right.start;
    if (since < 0 || since >= junction.duration) continue;
    result.push({ junction, progress: since / junction.duration, elapsed: microsToSeconds(since) });
  }
  return result;
}

/** Volume factors (0..1) for the left and right sound clips under a junction (equal-power). */
export function crossfadeGains(progress: number): { left: number; right: number } {
  const p = Math.min(1, Math.max(0, progress));
  return { left: Math.cos((p * Math.PI) / 2), right: Math.sin((p * Math.PI) / 2) };
}

/**
 * Volume factors for sound clips crossfading under `time`: the overlapping pairs on audio tracks
 * that a junction covers (a picture junction's linked sounds, junction rule 4). Clips not in the map
 * play at full volume.
 */
export function soundGains(
  project: ProjectState,
  composition: Composition,
  time: Micros,
): Map<ClipId, number> {
  const gains = new Map<ClipId, number>();
  for (const trackId of composition.trackOrder) {
    const track = project.tracks[trackId];
    if (track?.kind !== "audio") continue;
    for (let i = 1; i < track.clipIds.length; i++) {
      const left = project.clips[track.clipIds[i - 1]!];
      const right = project.clips[track.clipIds[i]!];
      if (!left || !right) continue;
      const since = time - right.start;
      const overlap = left.start + left.duration - right.start;
      if (since < 0 || since >= overlap) continue;
      if (allowedOverlap(project, left, right) <= 0) continue;
      const { left: l, right: r } = crossfadeGains(since / overlap);
      gains.set(left.id, l);
      gains.set(right.id, r);
    }
  }
  return gains;
}
