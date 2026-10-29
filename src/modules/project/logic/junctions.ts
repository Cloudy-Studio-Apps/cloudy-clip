import { produce } from "immer";
import type { Micros } from "@/core";
import type {
  Clip,
  ClipId,
  ClipMove,
  Junction,
  JunctionId,
  LayoutConflict,
  ProjectState,
} from "../project.types";
import { partnersOf } from "./links";

function end(clip: Clip): Micros {
  return clip.start + clip.duration;
}

/** The junction joining exactly these two clips (left, right), if any. */
export function junctionBetween(
  state: ProjectState,
  leftId: ClipId,
  rightId: ClipId,
): Junction | undefined {
  return Object.values(state.junctions).find(
    (j) => j.leftClipId === leftId && j.rightClipId === rightId,
  );
}

/** Junctions that have this clip on either side. */
export function junctionsOfClip(state: ProjectState, clipId: ClipId): Junction[] {
  return Object.values(state.junctions).filter(
    (j) => j.leftClipId === clipId || j.rightClipId === clipId,
  );
}

/** Junctions ordered by the track's position, then by time of the left clip. */
export function orderedJunctions(state: ProjectState): Junction[] {
  const trackIndex = (j: Junction) => {
    const i = state.trackOrder.indexOf(j.trackId);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const time = (j: Junction) => state.clips[j.leftClipId]?.start ?? 0;
  return Object.values(state.junctions).sort(
    (a, b) => trackIndex(a) - trackIndex(b) || time(a) - time(b),
  );
}

/**
 * How much `left` and `right` (same track, left.start < right.start) may overlap: the junction's
 * duration if one joins them, or, when each is linked to a side of a junction on another track
 * (spec rule 7: partner of left ↔ partner of right), that junction's duration; else 0.
 */
export function allowedOverlap(state: ProjectState, left: Clip, right: Clip): Micros {
  const own = junctionBetween(state, left.id, right.id);
  if (own) return own.duration;
  const rightPartners = partnersOf(state, right.id);
  for (const pl of partnersOf(state, left.id)) {
    for (const pr of rightPartners) {
      const linked = junctionBetween(state, pl.id, pr.id);
      if (linked) return linked.duration;
    }
  }
  return 0;
}

/** Moves for `fromClipId`, every later clip on its track, and all their linked partners, by `delta`. */
export function rippleMoves(state: ProjectState, fromClipId: ClipId, delta: Micros): ClipMove[] {
  const from = state.clips[fromClipId];
  const track = from && state.tracks[from.trackId];
  if (!from || !track) return [];
  const index = track.clipIds.indexOf(fromClipId);
  if (index < 0) return [];
  const moves = new Map<ClipId, ClipMove>();
  const add = (clip: Clip) => {
    if (!moves.has(clip.id)) moves.set(clip.id, { clipId: clip.id, start: clip.start + delta });
  };
  for (const id of track.clipIds.slice(index)) {
    const clip = state.clips[id];
    if (!clip) continue;
    add(clip);
    for (const partner of partnersOf(state, id)) add(partner);
  }
  return [...moves.values()];
}

/** A copy of the state with the moves (and optional junction writes) applied; pure (immer `produce`). */
export function applyMoves(
  state: ProjectState,
  moves: readonly ClipMove[],
  junctions?: Readonly<Record<JunctionId, Junction | null>>,
): ProjectState {
  return produce(state, (draft) => {
    const touched = new Set<string>();
    for (const move of moves) {
      const clip = draft.clips[move.clipId];
      if (!clip) continue;
      clip.start = move.start;
      touched.add(clip.trackId);
    }
    for (const trackId of touched) {
      const track = draft.tracks[trackId];
      if (track) {
        track.clipIds.sort((a, b) => (draft.clips[a]?.start ?? 0) - (draft.clips[b]?.start ?? 0));
      }
    }
    for (const [id, junction] of Object.entries(junctions ?? {})) {
      if (junction) draft.junctions[id] = junction;
      else delete draft.junctions[id];
    }
  });
}

/** First pair of clips on any track that overlaps by anything other than `allowedOverlap`, or starts < 0. */
export function findLayoutConflict(state: ProjectState): LayoutConflict | undefined {
  for (const trackId of state.trackOrder) {
    const track = state.tracks[trackId];
    if (!track) continue;
    const clips = track.clipIds.map((id) => state.clips[id]).filter((c): c is Clip => !!c);
    for (const [i, clip] of clips.entries()) {
      if (clip.start < 0) return { clip, other: clip };
      const next = clips[i + 1];
      if (next) {
        const overlap = end(clip) - next.start;
        if (overlap > 0 && overlap !== allowedOverlap(state, clip, next)) {
          return { clip, other: next };
        }
      }
      for (const later of clips.slice(i + 2)) {
        if (later.start >= end(clip)) break;
        return { clip, other: later };
      }
    }
  }
  return undefined;
}

/** Junctions whose clips are gone, on different tracks, or don't overlap by exactly `duration`. */
export function staleJunctions(state: ProjectState): JunctionId[] {
  return Object.values(state.junctions)
    .filter((j) => {
      const left = state.clips[j.leftClipId];
      const right = state.clips[j.rightClipId];
      if (!left || !right) return true;
      if (left.trackId !== right.trackId || left.trackId !== j.trackId) return true;
      return end(left) - right.start !== j.duration;
    })
    .map((j) => j.id);
}
