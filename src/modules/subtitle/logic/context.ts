import { MICROS_PER_SECOND, type Micros } from "@/core";
import { PEAKS_PER_SECOND } from "@/modules/media";
import {
  orderedTracks,
  sourceTimeAt,
  trackClips,
  type Clip,
  type CompositionId,
  type MediaId,
  type ProjectState,
} from "@/modules/project";

/** The enabled clips on a composition's video tracks that aren't cues. */
function pictures(state: ProjectState, compositionId: CompositionId): Clip[] {
  return orderedTracks(state, compositionId)
    .filter((track) => track.kind === "video")
    .flatMap((track) => trackClips(state, track))
    .filter((clip) => !clip.subtitle && !clip.disabled);
}

/**
 * Where the picture cuts in a composition: both edges of every enabled clip on a video track that
 * isn't a cue, in order, each once.
 */
export function pictureCuts(state: ProjectState, compositionId: CompositionId): Micros[] {
  const times = new Set<Micros>();
  for (const clip of pictures(state, compositionId)) {
    times.add(clip.start).add(clip.start + clip.duration);
  }
  return [...times].sort((a, b) => a - b);
}

/** The stretches between two cuts (`pictureCuts`) that show a picture, in order. */
export function pictureSpans(
  state: ProjectState,
  compositionId: CompositionId,
): { start: Micros; end: Micros }[] {
  const clips = pictures(state, compositionId);
  const cuts = pictureCuts(state, compositionId);
  return cuts.slice(1).flatMap((end, i) => {
    const start = cuts[i]!;
    const covered = clips.some((c) => c.start <= start && c.start + c.duration >= end);
    return covered ? [{ start, end }] : [];
  });
}

/**
 * The composition's sound from `from` to `to` in `buckets` columns, each 0-255: the loudest peak of
 * any enabled clip on an unmuted audio track there, read in its file through `sourceIn` and its
 * speed. `peaksOf` gives a file's peaks (`PEAKS_PER_SECOND`), or undefined while unknown; it is
 * asked only for clips in the range.
 */
export function soundLine(
  state: ProjectState,
  compositionId: CompositionId,
  peaksOf: (mediaId: MediaId) => Uint8Array | undefined,
  from: Micros,
  to: Micros,
  buckets: number,
): Uint8Array {
  const line = new Uint8Array(Math.max(0, buckets));
  if (buckets <= 0 || to <= from) return line;
  const step = (to - from) / buckets;
  const peakAt = (time: Micros) => Math.floor((time * PEAKS_PER_SECOND) / MICROS_PER_SECOND);
  for (const track of orderedTracks(state, compositionId)) {
    if (track.kind !== "audio" || track.muted) continue;
    for (const clip of trackClips(state, track)) {
      const end = clip.start + clip.duration;
      if (clip.disabled || !clip.mediaId || end <= from || clip.start >= to) continue;
      const peaks = peaksOf(clip.mediaId);
      if (!peaks) continue;
      const first = Math.max(0, Math.floor((clip.start - from) / step));
      const last = Math.min(buckets, Math.ceil((end - from) / step));
      for (let b = first; b < last; b++) {
        const t0 = Math.max(clip.start, from + b * step);
        const t1 = Math.min(end, from + (b + 1) * step);
        if (t1 <= t0) continue;
        const a = peakAt(sourceTimeAt(clip, t0));
        const z = peakAt(sourceTimeAt(clip, t1));
        let max = line[b]!;
        for (let i = Math.min(a, z); i <= Math.max(a, z) && i < peaks.length; i++) {
          if (peaks[i]! > max) max = peaks[i]!;
        }
        line[b] = max;
      }
    }
  }
  return line;
}
