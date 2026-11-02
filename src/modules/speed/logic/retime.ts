import { produce } from "immer";
import { CommandFailure, type Micros } from "@/core";
import { durationLimits } from "@/modules/junction";
import {
  RAMP_PATH,
  applyMoves,
  formatOf,
  junctionsOfClip,
  rampOf,
  rippleMoves,
  sourceSpan,
  speedOf,
  type Clip,
  type ClipId,
  type ClipMove,
  type ClipSpeed,
  type KeyTrack,
  type ProjectState,
  DEFAULT_SPEED,
} from "@/modules/project";
import { fitJunctions, minClipDuration, neighbourBounds } from "@/modules/timeline";
import type { JunctionKindOf } from "@/modules/timeline";
import type { GroupResize, SpeedChange } from "../speed.types";

/** Writes a speed on a clip, or removes it when it's what a clip has anyway. */
export function writeSpeed(clip: Clip, speed: ClipSpeed): void {
  const normal =
    speed.rate === DEFAULT_SPEED.rate &&
    speed.pitchCorrection === DEFAULT_SPEED.pitchCorrection &&
    speed.reversed === DEFAULT_SPEED.reversed;
  if (normal) delete clip.speed;
  else clip.speed = speed;
}

/**
 * A clip at the one rate that plays `span` of the file in its length, with its ramp gone. `span`
 * is taken before the ramp changes, since it can't be worked out from the clip afterwards.
 */
export function flattenRamp(clip: Clip, span: Micros): void {
  writeSpeed(clip, { ...speedOf(clip), rate: span / clip.duration });
  writeRamp(clip, undefined);
}

/** Puts a clip's ramp in place, or takes it away. */
export function writeRamp(clip: Clip, track: KeyTrack | undefined): void {
  const animation = { ...clip.animation };
  if (track) animation[RAMP_PATH] = track;
  else delete animation[RAMP_PATH];
  if (Object.keys(animation).length > 0) clip.animation = animation;
  else delete clip.animation;
}

/** Fails when a change asks of a ramped clip what its keys decide; drops the ramp if told to. */
export function settleRamp(
  state: ProjectState,
  group: readonly Clip[],
  input: SpeedChange,
): ProjectState {
  if (!group.some((clip) => rampOf(clip))) return state;
  const clipId = group[0]!.id;
  if (input.dropRamp) {
    return produce(state, (draft) => {
      for (const clip of group) flattenRamp(draft.clips[clip.id]!, sourceSpan(clip));
    });
  }
  if (input.rate) {
    throw new CommandFailure(
      "speed.ramped",
      `Clip "${clipId}" has a speed ramp, so its keys set its speed. Remove them with keyframe_clear on "speed.rate" first.`,
      { clipId },
    );
  }
  if (input.reversed) {
    throw new CommandFailure(
      "speed.reversed_ramp",
      `Clip "${clipId}" has a speed ramp, which can't play backwards. Remove its keys first.`,
      { clipId },
    );
  }
  return state;
}

/** Fails when a transition sits on the end of a clip, which only Ripple timeline may change. */
export function refuseJoinedEnd(state: ProjectState, group: readonly Clip[]): void {
  for (const clip of group) {
    if (junctionsOfClip(state, clip.id).some((j) => j.leftClipId === clip.id)) {
      throw new CommandFailure(
        "speed.joined",
        `Clip "${clip.id}" has a transition on its end, which would change without Ripple timeline. Turn Ripple timeline on, or remove the transition.`,
        { clipId: clip.id },
      );
    }
  }
}

/** The fastest of `rate` and what a clip needs to stop at what follows it. */
function rateWithoutRipple(state: ProjectState, group: readonly Clip[], rate: number): number {
  refuseJoinedEnd(state, group);
  let limit = rate;
  for (const clip of group) {
    const room = neighbourBounds(state, clip).nextStart - clip.start;
    limit = Math.max(limit, sourceSpan(clip) / room);
  }
  return limit;
}

/** Without ripple nothing may move, so a junction on a clip's start must still fit it. */
function refuseShortJoin(
  state: ProjectState,
  group: readonly Clip[],
  kindOf: JunctionKindOf,
): void {
  for (const { id } of group) {
    for (const junction of junctionsOfClip(state, id)) {
      const kind = kindOf(junction.kind);
      const left = state.clips[junction.leftClipId];
      const right = state.clips[junction.rightClipId];
      if (!kind || !left || !right || junction.duration === 0) continue;
      if (junction.duration <= durationLimits(kind, state, left, right).max) continue;
      throw new CommandFailure(
        "speed.joined",
        `Clip "${id}" would be too short for its transition. Turn Ripple timeline on, or remove the transition.`,
        { clipId: id },
      );
    }
  }
}

/** What follows each clip on its track moves by the change of its end, with partners. */
function followers(state: ProjectState, group: readonly Clip[], delta: Micros): ClipMove[] {
  const own = new Set<ClipId>(group.map((clip) => clip.id));
  const moves = new Map<ClipId, ClipMove>();
  for (const clip of group) {
    const ids = state.tracks[clip.trackId]?.clipIds ?? [];
    const next = ids[ids.indexOf(clip.id) + 1];
    if (next === undefined || own.has(next)) continue;
    for (const move of rippleMoves(state, next, delta)) {
      if (!own.has(move.clipId) && !moves.has(move.clipId)) moves.set(move.clipId, move);
    }
  }
  return [...moves.values()];
}

/**
 * A linked group at new lengths, each clip keeping its start. With `ripple`, what follows moves
 * too and junctions shrink as for a trim; without it nothing else moves.
 */
export function resize(
  state: ProjectState,
  group: readonly Clip[],
  { lengthOf, write, ripple }: GroupResize,
  kindOf: JunctionKindOf,
): ProjectState {
  const before = group[0]!;
  const changed = produce(state, (draft) => {
    for (const clip of group) {
      const target = draft.clips[clip.id]!;
      target.duration = lengthOf(clip);
      write(target, clip);
      const { sound } = target;
      if (sound) {
        sound.fadeIn = Math.min(sound.fadeIn, target.duration);
        sound.fadeOut = Math.min(sound.fadeOut, target.duration);
      }
    }
  });
  if (!ripple) {
    refuseShortJoin(changed, group, kindOf);
    return changed;
  }
  const moved = applyMoves(changed, followers(state, group, lengthOf(before) - before.duration));
  return fitJunctions(
    moved,
    group.map((clip) => clip.id),
    kindOf,
  );
}

/**
 * A linked group at a new rate. Each clip keeps its start and its part of the file, so its length
 * changes. With `ripple`, what follows moves too and junctions shrink as for a trim; without it
 * nothing else moves, a slower clip stops at the next one, and a transition on its end refuses.
 * Returns the new state and the rate that was applied.
 */
export function retime(
  state: ProjectState,
  group: readonly Clip[],
  wanted: number,
  ripple: boolean,
  kindOf: JunctionKindOf,
): { state: ProjectState; rate: number } {
  const shortest = Math.min(...group.map((clip) => minClipDuration(formatOf(state, clip))));
  const limit = Math.max(...group.map(sourceSpan)) / shortest;
  const wantedOrLimit = Math.min(wanted, Math.max(limit, 1));
  const rate = ripple ? wantedOrLimit : rateWithoutRipple(state, group, wantedOrLimit);
  const lengthOf = (clip: Clip) =>
    Math.max(minClipDuration(formatOf(state, clip)), Math.floor(sourceSpan(clip) / rate));
  const write = (target: Clip, clip: Clip) => writeSpeed(target, { ...speedOf(clip), rate });
  return { state: resize(state, group, { lengthOf, write, ripple }, kindOf), rate };
}
