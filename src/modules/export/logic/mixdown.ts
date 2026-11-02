import type { Micros } from "@/core";
import {
  allowedOverlap,
  type Clip,
  type CompositionId,
  type MediaId,
  type ProjectState,
  type Track,
} from "@/modules/project";
import type { ExportRange, MixEdges, MixWindow, SoundSegment } from "../export.types";

/** The overlap a junction allows between two neighbours of a track; 0 for plain neighbours. */
function overlapOf(project: ProjectState, left: Clip | undefined, right: Clip | undefined): Micros {
  if (!left || !right) return 0;
  const overlap = left.start + left.duration - right.start;
  return overlap > 0 && allowedOverlap(project, left, right) > 0 ? overlap : 0;
}

function walk(
  project: ProjectState,
  compositionId: CompositionId,
  { from, to, shift }: MixWindow,
  edges: MixEdges,
  hasSound: (id: MediaId) => boolean,
  out: SoundSegment[],
): void {
  const composition = project.compositions[compositionId];
  if (!composition) return;
  const end = Math.min(to, composition.duration);
  for (const trackId of composition.trackOrder) {
    const track: Track | undefined = project.tracks[trackId];
    if (track?.kind !== "audio" || track.muted) continue;
    const clips = track.clipIds.map((id) => project.clips[id]);
    clips.forEach((clip, i) => {
      if (!clip) return;
      const clipEnd = clip.start + clip.duration;
      const start = Math.max(from, clip.start);
      const stop = Math.min(end, clipEnd);
      if (stop <= start) return;
      // A cut through a fade keeps the part of it that is left.
      const skipped = start - clip.start;
      const dropped = clipEnd - stop;
      const fades = {
        fadeIn: Math.max(0, overlapOf(project, clips[i - 1], clip) - skipped),
        fadeOut: Math.max(0, overlapOf(project, clip, clips[i + 1]) - dropped),
      };
      if (clip.compositionRef !== undefined) {
        const local = clip.sourceIn - clip.start;
        const inner = { from: start + local, to: stop + local, shift: shift - local };
        walk(project, clip.compositionRef, inner, fades, hasSound, out);
        return;
      }
      if (clip.mediaId === undefined || !hasSound(clip.mediaId)) return;
      const media = project.media[clip.mediaId];
      if (!media || media.kind === "image") return;
      out.push({
        path: media.path,
        at: start + shift,
        from: clip.sourceIn + skipped,
        duration: stop - start,
        fadeIn: Math.max(fades.fadeIn, start === from ? edges.fadeIn : 0),
        fadeOut: Math.max(fades.fadeOut, stop === end ? edges.fadeOut : 0),
      });
    });
  }
}

/**
 * What sounds in a stretch of a composition, as stretches of files on the export's clock, at any
 * depth: the sound the preview plays. Muted tracks are left out, also around a placement. Clips
 * under a junction crossfade.
 */
export function mixdown(
  project: ProjectState,
  compositionId: CompositionId,
  range: ExportRange,
  hasSound: (id: MediaId) => boolean,
): SoundSegment[] {
  const out: SoundSegment[] = [];
  const window = { from: range.start, to: range.start + range.duration, shift: -range.start };
  walk(project, compositionId, window, { fadeIn: 0, fadeOut: 0 }, hasSound, out);
  return out;
}
