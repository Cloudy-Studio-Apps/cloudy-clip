import { type CompositionId, type MediaId, type ProjectState } from "@/modules/project";
import type { ExportRange } from "../export.types";

/** The files of a stretch that some clip plays backwards. */
export function reversedMedia(
  project: ProjectState,
  compositionId: CompositionId,
  range: ExportRange,
): Set<MediaId> {
  const used = usedMedia(project, compositionId, range);
  const reversed = Object.values(project.clips).flatMap((clip) =>
    clip.speed?.reversed && clip.mediaId !== undefined && used.has(clip.mediaId)
      ? [clip.mediaId]
      : [],
  );
  return new Set(reversed);
}

/** Every file a stretch of a composition shows or plays, at any depth. */
export function usedMedia(
  project: ProjectState,
  compositionId: CompositionId,
  range: ExportRange,
): Set<MediaId> {
  const used = new Set<MediaId>();
  const walk = (id: CompositionId, from: number, to: number) => {
    const composition = project.compositions[id];
    if (!composition) return;
    for (const trackId of composition.trackOrder) {
      for (const clipId of project.tracks[trackId]?.clipIds ?? []) {
        const clip = project.clips[clipId];
        if (!clip || clip.disabled) continue;
        const start = Math.max(from, clip.start);
        const stop = Math.min(to, clip.start + clip.duration);
        if (stop <= start) continue;
        if (clip.mediaId !== undefined) used.add(clip.mediaId);
        if (clip.compositionRef !== undefined) {
          const local = clip.sourceIn - clip.start;
          walk(clip.compositionRef, start + local, stop + local);
        }
      }
    }
  };
  walk(compositionId, range.start, range.start + range.duration);
  return used;
}
