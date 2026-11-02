import type { Micros } from "@/core";
import {
  allowedOverlap,
  bandActive,
  contentTime,
  dbToLinear,
  pitchShift,
  soundOf,
  sourceTimeAt,
  speedOf,
  trackValue,
  type Clip,
  type ClipSound,
  type ClipSpeed,
  type KeyTrack,
  type CompositionId,
  type MediaId,
  type ProjectState,
  type Track,
} from "@/modules/project";
import { envelope } from "./envelope";
import type { ExportRange, MixEdges, MixWindow, SoundSegment } from "../export.types";

/** The overlap a junction allows between two neighbours of a track; 0 for plain neighbours. */
function overlapOf(project: ProjectState, left: Clip | undefined, right: Clip | undefined): Micros {
  if (!left || !right || left.disabled || right.disabled) return 0;
  const overlap = left.start + left.duration - right.start;
  return overlap > 0 && allowedOverlap(project, left, right) > 0 ? overlap : 0;
}

/** What a clip's sound adds to a segment; nothing at the defaults. */
function soundFields(
  sound: ClipSound,
  gain: number,
  keyed: Pick<SoundSegment, "gainEnvelope" | "panEnvelope">,
): Partial<SoundSegment> {
  const eq = sound.eq.on
    ? sound.eq.bands.filter(bandActive).map(({ shape, hz, db, q }) => ({ kind: shape, hz, db, q }))
    : [];
  const pitch = pitchShift(sound);
  return {
    ...(keyed.gainEnvelope ? { gainEnvelope: keyed.gainEnvelope } : gain !== 1 && { gain }),
    ...(keyed.panEnvelope
      ? { panEnvelope: keyed.panEnvelope }
      : sound.pan !== 0 && { pan: sound.pan }),
    ...(eq.length > 0 && { eq }),
    ...(pitch !== 0 && { pitch }),
  };
}

/** The envelopes of a clip's keyed volume and pan over the part of it that sounds. */
function keyedFields(
  clip: Clip,
  parentGain: number,
  start: Micros,
  stop: Micros,
): Pick<SoundSegment, "gainEnvelope" | "panEnvelope"> {
  const volume = clip.animation?.["sound.volumeDb"];
  const pan = clip.animation?.["sound.pan"];
  const read = (track: KeyTrack, time: Micros) =>
    Number(trackValue(track, contentTime(clip, time)));
  return {
    ...(volume?.keys.length && {
      gainEnvelope: envelope((time) => parentGain * dbToLinear(read(volume, time)), start, stop),
    }),
    ...(pan?.keys.length && { panEnvelope: envelope((time) => read(pan, time), start, stop) }),
  };
}

/** What a clip's speed adds to a segment; nothing at normal speed. */
function speedFields({ rate, pitchCorrection, reversed }: ClipSpeed): Partial<SoundSegment> {
  return {
    ...(reversed && { reversed }),
    ...(rate !== 1 && { speed: rate, ...(!pitchCorrection && { keepPitch: false }) }),
  };
}

function walk(
  project: ProjectState,
  compositionId: CompositionId,
  { from, to, shift }: MixWindow,
  edges: MixEdges,
  gain: number,
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
      if (!clip || clip.disabled) return;
      const clipEnd = clip.start + clip.duration;
      const start = Math.max(from, clip.start);
      const stop = Math.min(end, clipEnd);
      if (stop <= start) return;
      // A cut through a fade keeps the part of it that is left.
      const skipped = start - clip.start;
      const dropped = clipEnd - stop;
      const sound = soundOf(clip);
      const level = gain * dbToLinear(sound.volumeDb);
      // The longer of a crossfade and the clip's own fade wins.
      const fades = {
        fadeIn: Math.max(
          0,
          overlapOf(project, clips[i - 1], clip) - skipped,
          sound.fadeIn - skipped,
        ),
        fadeOut: Math.max(
          0,
          overlapOf(project, clip, clips[i + 1]) - dropped,
          sound.fadeOut - dropped,
        ),
      };
      if (clip.compositionRef !== undefined) {
        const local = clip.sourceIn - clip.start;
        const inner = { from: start + local, to: stop + local, shift: shift - local };
        walk(project, clip.compositionRef, inner, fades, level, hasSound, out);
        return;
      }
      if (clip.mediaId === undefined || !hasSound(clip.mediaId)) return;
      const media = project.media[clip.mediaId];
      if (!media || media.kind === "image") return;
      out.push({
        path: media.path,
        at: start + shift,
        // Reversed, the file's earliest moment of this stretch is the one heard last.
        from: sourceTimeAt(clip, speedOf(clip).reversed ? stop : start),
        duration: stop - start,
        fadeIn: Math.max(fades.fadeIn, start === from ? edges.fadeIn : 0),
        fadeOut: Math.max(fades.fadeOut, stop === end ? edges.fadeOut : 0),
        ...soundFields(sound, level, keyedFields(clip, gain, start, stop)),
        ...speedFields(speedOf(clip)),
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
  walk(project, compositionId, window, { fadeIn: 0, fadeOut: 0 }, 1, hasSound, out);
  return out;
}
