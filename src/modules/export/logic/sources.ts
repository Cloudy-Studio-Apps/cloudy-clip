import { type Clip, type CompositionId, type MediaId, type ProjectState } from "@/modules/project";
import type { ExportRange } from "../export.types";

/** Every clip a stretch of a composition shows or plays, at any depth. */
function playedClips(
  project: ProjectState,
  compositionId: CompositionId,
  range: ExportRange,
): Clip[] {
  const played: Clip[] = [];
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
        played.push(clip);
        if (clip.compositionRef !== undefined) {
          const local = clip.sourceIn - clip.start;
          walk(clip.compositionRef, start + local, stop + local);
        }
      }
    }
  };
  walk(compositionId, range.start, range.start + range.duration);
  return played;
}

/** Every file a stretch of a composition shows or plays, at any depth. */
export function usedMedia(
  project: ProjectState,
  compositionId: CompositionId,
  range: ExportRange,
): Set<MediaId> {
  const ids = playedClips(project, compositionId, range).flatMap((clip) => clip.mediaId ?? []);
  return new Set(ids);
}

/** The files a stretch shows backwards. Sound needs no copy: export reverses that itself. */
export function reversedMedia(
  project: ProjectState,
  compositionId: CompositionId,
  range: ExportRange,
): Set<MediaId> {
  const shown = playedClips(project, compositionId, range).filter(
    (clip) => clip.speed?.reversed && project.tracks[clip.trackId]?.kind === "video",
  );
  return new Set(shown.flatMap((clip) => clip.mediaId ?? []));
}
