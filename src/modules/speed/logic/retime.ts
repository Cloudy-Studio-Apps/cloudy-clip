import { produce } from "immer";
import { CommandFailure, type Micros } from "@/core";
import {
  applyMoves,
  formatOf,
  junctionsOfClip,
  rippleMoves,
  sourceSpan,
  speedOf,
  type Clip,
  type ClipId,
  type ClipMove,
  type ClipSpeed,
  type ProjectState,
  DEFAULT_SPEED,
} from "@/modules/project";
import { fitJunctions, minClipDuration, neighbourBounds } from "@/modules/timeline";
import type { JunctionKindOf } from "@/modules/timeline";

/** Writes a speed on a clip, or removes it when it's what a clip has anyway. */
export function writeSpeed(clip: Clip, speed: ClipSpeed): void {
  const normal =
    speed.rate === DEFAULT_SPEED.rate &&
    speed.pitchCorrection === DEFAULT_SPEED.pitchCorrection &&
    speed.reversed === DEFAULT_SPEED.reversed;
  if (normal) delete clip.speed;
  else clip.speed = speed;
}

/** The fastest of `rate` and what a clip needs to stop at what follows it. */
function rateWithoutRipple(state: ProjectState, group: readonly Clip[], rate: number): number {
  let limit = rate;
  for (const clip of group) {
    if (junctionsOfClip(state, clip.id).some((j) => j.leftClipId === clip.id)) {
      throw new CommandFailure(
        "speed.joined",
        `Clip "${clip.id}" has a transition on its end, which would change without Ripple timeline. Turn Ripple timeline on, or remove the transition.`,
        { clipId: clip.id },
      );
    }
    const room = neighbourBounds(state, clip).nextStart - clip.start;
    limit = Math.max(limit, sourceSpan(clip) / room);
  }
  return limit;
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
  const rate = ripple ? wanted : rateWithoutRipple(state, group, wanted);
  const before = group[0]!;
  const lengthOf = (clip: Clip) =>
    Math.max(minClipDuration(formatOf(state, clip)), Math.floor(sourceSpan(clip) / rate));
  const changed = produce(state, (draft) => {
    for (const clip of group) {
      const target = draft.clips[clip.id]!;
      target.duration = lengthOf(clip);
      writeSpeed(target, { ...speedOf(clip), rate });
      const { sound } = target;
      if (sound) {
        sound.fadeIn = Math.min(sound.fadeIn, target.duration);
        sound.fadeOut = Math.min(sound.fadeOut, target.duration);
      }
    }
  });
  if (!ripple) return { state: changed, rate };
  const moved = applyMoves(changed, followers(state, group, lengthOf(before) - before.duration));
  const fitted = fitJunctions(
    moved,
    group.map((clip) => clip.id),
    kindOf,
  );
  return { state: fitted, rate };
}
