import { produce } from "immer";
import type { CommandContext, Micros } from "@/core";
import { checkDuration, durationLimits, junctionRef } from "@/modules/junction";
import {
  applyMoves,
  junctionsOfClip,
  projectRef,
  rippleMoves,
  type Clip,
  type ClipId,
  type ClipMove,
  type Junction,
  type JunctionId,
  type ProjectState,
} from "@/modules/project";
import type { ClipTrackMove, JunctionEdit, JunctionKindOf, TrimEdge } from "./timeline.types";

function end(clip: Clip): Micros {
  return clip.start + clip.duration;
}

/** The kernel's junction kinds; a kind no loaded module registers is undefined (spec rule 11). */
export function junctionKindOf(ctx: CommandContext): JunctionKindOf {
  const api = ctx.require(junctionRef);
  return (kind) => api.get(kind)?.definition;
}

/** Junctions with any of these clips on a side, without duplicates. */
function junctionsOf(state: ProjectState, clipIds: Iterable<ClipId>): Junction[] {
  const found = new Map<JunctionId, Junction>();
  for (const id of clipIds) for (const j of junctionsOfClip(state, id)) found.set(j.id, j);
  return [...found.values()];
}

/** `state` with the clips moved (start, and track for those that change it); orders stay sorted. */
export function moveClips(state: ProjectState, moves: readonly ClipTrackMove[]): ProjectState {
  const retracked = produce(state, (draft) => {
    for (const move of moves) {
      const clip = draft.clips[move.clipId];
      const to = draft.tracks[move.trackId];
      if (!clip || !to || clip.trackId === move.trackId) continue;
      const from = draft.tracks[clip.trackId];
      if (from) from.clipIds = from.clipIds.filter((id) => id !== clip.id);
      to.clipIds.push(clip.id);
      clip.trackId = move.trackId;
    }
  });
  return applyMoves(retracked, moves);
}

/**
 * The junctions of moved clips after a move (spec rule 10): the same overlap keeps the junction;
 * another overlap becomes its duration when the kind's limits allow it (else
 * `junction.invalid_duration`; an unregistered kind isn't checked); touching, apart or on
 * different tracks removes an overlapping junction (no shift back). A junction without overlap
 * stays only while its clips touch.
 */
export function followMove(
  moved: ProjectState,
  movedIds: Iterable<ClipId>,
  kindOf: JunctionKindOf,
): JunctionEdit {
  const writes: Record<JunctionId, Junction | null> = {};
  const removed: JunctionId[] = [];
  for (const junction of junctionsOf(moved, movedIds)) {
    const left = moved.clips[junction.leftClipId];
    const right = moved.clips[junction.rightClipId];
    const adjacent =
      left !== undefined &&
      right !== undefined &&
      left.trackId === right.trackId &&
      left.start < right.start &&
      end(left) < end(right);
    const overlap = adjacent ? end(left) - right.start : -1;
    if (adjacent && overlap === junction.duration) {
      if (junction.trackId !== left.trackId)
        writes[junction.id] = { ...junction, trackId: left.trackId };
      continue;
    }
    if (adjacent && junction.duration > 0 && overlap > 0) {
      const kind = kindOf(junction.kind);
      if (kind) checkDuration(kind, overlap, durationLimits(kind, moved, left, right));
      writes[junction.id] = { ...junction, duration: overlap };
      continue;
    }
    writes[junction.id] = null;
    removed.push(junction.id);
  }
  return { state: applyMoves(moved, [], writes), removed };
}

/**
 * Shrinks the junctions of these clips that are now longer than their kind allows (the clips got
 * shorter) to the new maximum, moving the right clip, what follows it on the track and their
 * partners later by the difference (spec rule 10). Fails with `junction.invalid_duration` when the
 * kind no longer fits at all. Unregistered kinds are left alone.
 */
export function fitJunctions(
  state: ProjectState,
  clipIds: Iterable<ClipId>,
  kindOf: JunctionKindOf,
): ProjectState {
  let next = state;
  for (const junction of junctionsOf(state, clipIds)) {
    const kind = kindOf(junction.kind);
    const left = next.clips[junction.leftClipId];
    const right = next.clips[junction.rightClipId];
    if (!kind || junction.duration === 0 || !left || !right) continue;
    const limits = durationLimits(kind, next, left, right);
    if (junction.duration <= limits.max) continue;
    checkDuration(kind, limits.max, limits);
    next = applyMoves(next, rippleMoves(next, right.id, junction.duration - limits.max), {
      [junction.id]: { ...junction, duration: limits.max },
    });
  }
  return next;
}

/**
 * A trim with its junctions kept (spec rule 10): each joined edge that moved, shorter or longer
 * (a left clip's end, a right clip's start), ripples the right clip, what follows it on the track and their partners
 * by the change, so the overlap stays; then junctions shrink to fit the new lengths.
 */
export function rippleTrim(
  before: ProjectState,
  trimmed: ProjectState,
  clipIds: readonly ClipId[],
  edge: TrimEdge,
  kindOf: JunctionKindOf,
): ProjectState {
  const ids = new Set(clipIds);
  const moves = new Map<ClipId, ClipMove>();
  for (const junction of Object.values(before.junctions)) {
    const own = edge === "end" ? junction.leftClipId : junction.rightClipId;
    const old = before.clips[own];
    const now = trimmed.clips[own];
    if (!ids.has(own) || !old || !now) continue;
    const shift = edge === "end" ? end(now) - end(old) : old.start - now.start;
    if (shift === 0) continue;
    // Every trimmed clip got the same edge (linkedTrimEdge), so every joined edge changed by the
    // same shift; the ripples of a picture's junction and of its sound's overlap the same clips,
    // so each clip moves once (summing would move it twice).
    for (const move of rippleMoves(trimmed, junction.rightClipId, shift)) {
      if (!moves.has(move.clipId)) moves.set(move.clipId, move);
    }
  }
  return fitJunctions(applyMoves(trimmed, [...moves.values()]), clipIds, kindOf);
}

/** Overlapping junctions whose overlap contains `at` (their clips can't be split there). */
export function junctionsOverlapping(state: ProjectState, at: Micros): Junction[] {
  return Object.values(state.junctions).filter((junction) => {
    const right = state.clips[junction.rightClipId];
    return (
      junction.duration > 0 &&
      right !== undefined &&
      at >= right.start &&
      at <= right.start + junction.duration
    );
  });
}

/**
 * Writes the clips, tracks and junctions that differ between `before` (the project as the command
 * found it) and `next` into the project, in one undo step.
 */
export function commitState(ctx: CommandContext, before: ProjectState, next: ProjectState): void {
  ctx.mutate(ctx.require(projectRef).store, (draft) => {
    for (const id of Object.keys(before.clips)) if (!next.clips[id]) delete draft.clips[id];
    for (const [id, clip] of Object.entries(next.clips)) {
      if (before.clips[id] !== clip) draft.clips[id] = clip;
    }
    for (const [id, track] of Object.entries(next.tracks)) {
      if (before.tracks[id] !== track) draft.tracks[id] = track;
    }
    for (const id of Object.keys(before.junctions)) {
      if (!next.junctions[id]) delete draft.junctions[id];
    }
    for (const [id, junction] of Object.entries(next.junctions)) {
      if (before.junctions[id] !== junction) draft.junctions[id] = junction;
    }
  });
}
