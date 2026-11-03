import type { Micros } from "@/core";
import {
  allowedOverlap,
  bandActive,
  contentTime,
  dbToLinear,
  pitchShift,
  rampOf,
  soundOf,
  sourceTimeAt,
  speedOf,
  timeOfContent,
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
import { envelope, keyMoments } from "./envelope";
import type { ExportRange, MixEdges, MixWindow, SoundSegment, TempoStep } from "../export.types";

/** Timeline time a tempo step of a ramp covers, short enough that the steps aren't heard. */
const TEMPO_STEP: Micros = 250_000;
/** The shortest tempo step: a shorter one joins its neighbour, so each outlasts the crossfade. */
const SHORTEST_STEP: Micros = 50_000;

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
  const breaks = (track: KeyTrack) =>
    keyMoments(track, contentTime(clip, start), contentTime(clip, stop)).map((t) =>
      timeOfContent(clip, t),
    );
  return {
    ...(volume?.keys.length && {
      gainEnvelope: envelope(
        (time) => parentGain * dbToLinear(read(volume, time)),
        start,
        stop,
        breaks(volume),
      ),
    }),
    ...(pan?.keys.length && {
      panEnvelope: envelope((time) => read(pan, time), start, stop, breaks(pan)),
    }),
  };
}

/** What a clip's speed adds to a segment; nothing at normal speed. */
function speedFields({ rate, pitchCorrection, reversed }: ClipSpeed): Partial<SoundSegment> {
  return {
    ...(reversed && { reversed }),
    ...(rate !== 1 && { speed: rate, ...(!pitchCorrection && { keepPitch: false }) }),
  };
}

/** Whether the rate stays the same between a ramp's key `i` and the next one. */
function steady(ramp: KeyTrack, i: number): boolean {
  const key = ramp.keys[i]!;
  return key.ease?.kind === "hold" || key.value === ramp.keys[i + 1]!.value;
}

/**
 * Timeline stretches of `start..stop` cut at the ramp's keys, each with whether its rate is
 * steady: before the first key, after the last, on a Hold or between equal keys.
 */
function rampStretches(clip: Clip, ramp: KeyTrack, start: Micros, stop: Micros) {
  const times = ramp.keys.map((key) => timeOfContent(clip, key.t));
  const cuts = [start, ...times.filter((t) => t > start && t < stop), stop];
  return cuts.slice(1).map((end, i) => {
    const from = cuts[i]!;
    const middle = (from + end) / 2;
    const after = times.filter((t) => t <= middle).length;
    const still = after === 0 || after === times.length || steady(ramp, after - 1);
    return { from, end, still };
  });
}

/** Cuts with none closer than `SHORTEST_STEP` to the one before; the first and last stay. */
function spaced(cuts: readonly Micros[]): Micros[] {
  const last = cuts[cuts.length - 1]!;
  const kept = [cuts[0]!];
  for (const cut of cuts.slice(1, -1)) {
    if (cut - kept[kept.length - 1]! >= SHORTEST_STEP && last - cut >= SHORTEST_STEP) {
      kept.push(cut);
    }
  }
  kept.push(last);
  return kept;
}

/**
 * A ramped clip's stretch `start..stop` as steps of one tempo each, in file order: one for each
 * stretch where the rate holds, and one per `TEMPO_STEP` (rounded, the last taking what is left)
 * where it changes; none shorter than `SHORTEST_STEP` unless the stretch is. Each plays its own
 * part of the file in its time, so the steps meet in the file and their lengths add up to the
 * stretch's.
 */
function tempoSteps(clip: Clip, ramp: KeyTrack, start: Micros, stop: Micros): TempoStep[] {
  const cuts: Micros[] = [start];
  for (const { from, end, still } of rampStretches(clip, ramp, start, stop)) {
    const count = still ? 1 : Math.max(1, Math.round((end - from) / TEMPO_STEP));
    for (let i = 1; i < count; i++) cuts.push(from + i * TEMPO_STEP);
    cuts.push(end);
  }
  const kept = spaced(cuts);
  return kept.slice(1).map((end, i) => {
    const at = kept[i]!;
    const from = sourceTimeAt(clip, at);
    return { from, duration: end - at, speed: (sourceTimeAt(clip, end) - from) / (end - at) };
  });
}

/** What a ramp adds to a segment instead of a speed. A ramp is never reversed. */
function rampFields(
  clip: Clip,
  ramp: KeyTrack,
  start: Micros,
  stop: Micros,
): Partial<SoundSegment> {
  return {
    tempoSteps: tempoSteps(clip, ramp, start, stop),
    ...(!speedOf(clip).pitchCorrection && { keepPitch: false }),
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
      const ramp = rampOf(clip);
      out.push({
        path: media.path,
        at: start + shift,
        // Reversed, the file's earliest moment of this stretch is the one heard last.
        from: sourceTimeAt(clip, speedOf(clip).reversed ? stop : start),
        duration: stop - start,
        fadeIn: Math.max(fades.fadeIn, start === from ? edges.fadeIn : 0),
        fadeOut: Math.max(fades.fadeOut, stop === end ? edges.fadeOut : 0),
        ...soundFields(sound, level, keyedFields(clip, gain, start, stop)),
        ...(ramp ? rampFields(clip, ramp, start, stop) : speedFields(speedOf(clip))),
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
