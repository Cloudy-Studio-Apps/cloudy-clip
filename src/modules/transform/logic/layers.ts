import type { Micros } from "@/core";
import type { MediaId, PictureSize, ProjectState } from "@/modules/project";
import type { VisibleLayer } from "../transform.types";

/**
 * Video clips whose picture is on screen at `time`, top-most first (the order to hit-test in).
 * Clips whose picture size isn't known yet are left out.
 */
export function visibleLayers(
  state: ProjectState,
  sizeOf: (mediaId: MediaId) => PictureSize | undefined,
  time: Micros,
): VisibleLayer[] {
  const layers: VisibleLayer[] = [];
  for (const trackId of state.trackOrder) {
    const track = state.tracks[trackId];
    if (!track || track.kind !== "video" || track.hidden) continue;
    for (const clipId of track.clipIds) {
      const clip = state.clips[clipId];
      if (!clip) continue;
      if (clip.start > time) break; // sorted by start
      if (time >= clip.start + clip.duration) continue;
      if (state.media[clip.mediaId]?.kind !== "video") continue;
      const source = sizeOf(clip.mediaId);
      if (source) layers.push({ clipId, source });
    }
  }
  return layers;
}
