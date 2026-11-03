import type { Micros } from "@/core";
import {
  allowedOverlap,
  bandActive,
  contentTime,
  compositionMixOf,
  dbToLinear,
  heardDenoise,
  pitchShift,
  rampOf,
  soundOf,
  sourceTimeAt,
  soundInPlacement,
  speedOf,
  timeOfContent,
  trackMixOf,
  trackValue,
  type Clip,
  type ClipSound,
  type EqBand,
  type SoundEffect,
  type ClipSpeed,
  type KeyTrack,
  type CompositionId,
  type MediaId,
  type ProjectState,
  type Track,
  type TrackId,
} from "@/modules/project";
import { envelope, keyMoments } from "./envelope";
import type {
  ExportRange,
  EqFilter,
  MixEdges,
  MixEffect,
  MixNesting,
  MixWindow,
  Mixdown,
  Place,
  Placed,
  SoundFile,
  SoundMix,
  SoundSegment,
  TempoStep,
} from "../export.types";

/** Every clip sounds from its own file. */
const ITS_OWN_FILE: SoundFile = (asset) => asset.path;

/** The mix of a composition without audio tracks: nothing to mix, the master as it is. */
export const NO_MIX: SoundMix = { tracks: [], master: { gain: 1 } };

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

/** The bands of an equalizer that change the sound, as filters. */
const eqFilters = (bands: readonly EqBand[]): EqFilter[] =>
  bands.filter(bandActive).map(({ shape, hz, db, q }) => ({ kind: shape, hz, db, q }));

/** What a clip's sound adds to a segment; nothing at the defaults. */
function soundFields(
  sound: ClipSound,
  { gain, pan }: Placed,
  keyed: Pick<SoundSegment, "gainEnvelope" | "panEnvelope">,
): Partial<SoundSegment> {
  const eq = sound.eq.on ? eqFilters(sound.eq.bands) : [];
  const pitch = pitchShift(sound);
  return {
    ...(keyed.gainEnvelope ? { gainEnvelope: keyed.gainEnvelope } : gain !== 1 && { gain }),
    ...(keyed.panEnvelope ? { panEnvelope: keyed.panEnvelope } : pan !== 0 && { pan }),
    ...(eq.length > 0 && { eq }),
    ...(pitch !== 0 && { pitch }),
  };
}

/** The envelopes of a clip's keyed volume and pan over the part of it that sounds. */
function keyedFields(
  clip: Clip,
  place: Place,
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
        (time) => place(parentGain * dbToLinear(read(volume, time)), 0).gain,
        start,
        stop,
        breaks(volume),
      ),
    }),
    ...(pan?.keys.length && {
      panEnvelope: envelope((time) => place(1, read(pan, time)).pan, start, stop, breaks(pan)),
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
  nesting: MixNesting | null,
  hasSound: (id: MediaId) => boolean,
  soundFile: SoundFile,
  out: SoundSegment[],
): void {
  const composition = project.compositions[compositionId];
  if (!composition) return;
  const end = Math.min(to, composition.duration);
  let audioIndex = -1;
  for (const trackId of composition.trackOrder) {
    const track: Track | undefined = project.tracks[trackId];
    if (track?.kind !== "audio") continue;
    audioIndex++;
    if (track.muted) continue;
    // Top-level, a track's own mix is its bus's, applied once there; inside a placement, the
    // clips sound through the outer track's bus, with this track's mix folded in as the preview does.
    const index = nesting ? nesting.track : audioIndex;
    const place: Place = (gain, pan) =>
      nesting ? soundInPlacement(track, nesting.pan, gain, pan) : { gain, pan };
    const through = nesting?.gain ?? 1;
    // Inside a placement, the clips get the noise reduction of the track it sits on.
    const denoise = nesting ? nesting.denoise : heardDenoise(track, composition);
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
      const level = through * dbToLinear(sound.volumeDb);
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
        const placed = place(level, 0);
        walk(
          project,
          clip.compositionRef,
          inner,
          fades,
          { track: index, ...placed, denoise },
          hasSound,
          soundFile,
          out,
        );
        return;
      }
      if (clip.mediaId === undefined || !hasSound(clip.mediaId)) return;
      const media = project.media[clip.mediaId];
      if (!media || media.kind === "image") return;
      const ramp = rampOf(clip);
      out.push({
        path: soundFile(media, denoise),
        at: start + shift,
        // Reversed, the file's earliest moment of this stretch is the one heard last.
        from: sourceTimeAt(clip, speedOf(clip).reversed ? stop : start),
        duration: stop - start,
        track: index,
        fadeIn: Math.max(fades.fadeIn, start === from ? edges.fadeIn : 0),
        fadeOut: Math.max(fades.fadeOut, stop === end ? edges.fadeOut : 0),
        ...soundFields(
          sound,
          place(level, sound.pan),
          keyedFields(clip, place, through, start, stop),
        ),
        ...(ramp ? rampFields(clip, ramp, start, stop) : speedFields(speedOf(clip))),
      });
    });
  }
}

/**
 * The effects of a chain that change the sound, as the preview runs them: off ones, noise
 * reduction (a rendered file) and an EQ without a working band are left out, and a duck listens
 * to tracks by their index in `tracks` (one that isn't there keys nothing).
 */
function mixEffects(
  effects: readonly SoundEffect[] | undefined,
  tracks: readonly TrackId[],
): MixEffect[] {
  return (effects ?? []).flatMap((effect): MixEffect[] => {
    if (!effect.on) return [];
    switch (effect.kind) {
      case "eq": {
        const bands = eqFilters(effect.bands);
        return bands.length > 0 ? [{ kind: "eq", bands }] : [];
      }
      case "compressor":
        return [{ kind: "compressor", params: effect.params }];
      case "gate": {
        const { thresholdDb, ratio, attackMs, releaseMs } = effect;
        return [{ kind: "gate", thresholdDb, ratio, attackMs, releaseMs }];
      }
      case "deesser":
        return [{ kind: "deesser", frequencyHz: effect.frequencyHz, amount: effect.amount }];
      case "limiter":
        return [{ kind: "limiter", ceilingDb: effect.ceilingDb, releaseMs: effect.releaseMs }];
      case "denoise":
        return [];
      case "duck": {
        const { depthDb, attackMs, releaseMs } = effect;
        const listensTo = effect.listensTo.flatMap((id) => {
          const index = tracks.indexOf(id);
          return index < 0 ? [] : [index];
        });
        return [{ kind: "duck", listensTo, depthDb, attackMs, releaseMs }];
      }
    }
  });
}

/** `effects` when there are some, for a spec that leaves them out otherwise. */
const withEffects = (effects: MixEffect[]) => (effects.length > 0 ? { effects } : {});

/**
 * The mix of the composition's audio tracks, in order, and of its master, as linear levels, with
 * the effects that work. Muted tracks keep their place (their clips are left out, so a duck
 * listening to one hears nothing).
 */
function mixOf(project: ProjectState, compositionId: CompositionId): Mixdown["mix"] {
  const composition = project.compositions[compositionId];
  if (!composition) return NO_MIX;
  const audio = composition.trackOrder.filter((id) => project.tracks[id]?.kind === "audio");
  const tracks = audio.map((id) => {
    const { volumeDb, pan, effects } = trackMixOf(project.tracks[id]!);
    return { gain: dbToLinear(volumeDb), pan, ...withEffects(mixEffects(effects, audio)) };
  });
  const master = compositionMixOf(composition).master;
  return {
    tracks,
    master: {
      gain: dbToLinear(master.volumeDb),
      ...withEffects(mixEffects(master.effects, audio)),
    },
  };
}

/**
 * What sounds in a stretch of a composition, as stretches of files on the export's clock, at any
 * depth, and how the tracks they sit on mix: the sound the preview plays. A clip sounds through
 * its top-level track (`track`); inside a placement, the inner tracks' volume and pan are folded
 * into the clip's own, as the preview does. Muted tracks are left out, also around a placement.
 * Clips under a junction crossfade. Solo is never here: it isn't in the document. A clip heard
 * through noise reduction (`heardDenoise`) is mixed from the file `soundFile` gives for it.
 */
export function mixdown(
  project: ProjectState,
  compositionId: CompositionId,
  range: ExportRange,
  hasSound: (id: MediaId) => boolean,
  soundFile: SoundFile = ITS_OWN_FILE,
): Mixdown {
  const segments: SoundSegment[] = [];
  const window = { from: range.start, to: range.start + range.duration, shift: -range.start };
  const edges = { fadeIn: 0, fadeOut: 0 };
  walk(project, compositionId, window, edges, null, hasSound, soundFile, segments);
  return { segments, mix: mixOf(project, compositionId) };
}
