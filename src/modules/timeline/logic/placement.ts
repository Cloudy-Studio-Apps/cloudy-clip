import type { Micros } from "@/core";
import {
  allowedOverlap,
  type Clip,
  type ClipId,
  type ProjectState,
  type TrackId,
  type TrackKind,
} from "@/modules/project";
import type { TrimLimits } from "../timeline.types";

/** Smallest clip length allowed: one frame at the project frame rate. */
export function minClipDuration(state: ProjectState): Micros {
  return Math.ceil(1_000_000 / state.format.fps);
}

/**
 * Returns the first clip on the track overlapping `[start, start + duration)`, ignoring some.
 * When the span is `self` placed there, a neighbour it overlaps at one edge by exactly the
 * allowed overlap (a junction joining them, spec rule 12) is not in the way.
 */
export function findOverlap(
  state: ProjectState,
  trackId: TrackId,
  start: Micros,
  duration: Micros,
  ignore: ReadonlySet<ClipId> = new Set(),
  self?: Clip,
): Clip | undefined {
  const end = start + duration;
  const track = state.tracks[trackId];
  if (!track) return undefined;
  for (const id of track.clipIds) {
    if (ignore.has(id)) continue;
    const clip = state.clips[id];
    if (!clip || !(clip.start < end && start < clip.start + clip.duration)) continue;
    if (self && joinedOverlap(state, self, start, end, clip)) continue;
    return clip;
  }
  return undefined;
}

/** `self` at `[start, end)` overlaps `other` at one edge by exactly their allowed overlap. */
function joinedOverlap(
  state: ProjectState,
  self: Clip,
  start: Micros,
  end: Micros,
  other: Clip,
): boolean {
  const otherEnd = other.start + other.duration;
  if (start < other.start && end < otherEnd) {
    return end - other.start === allowedOverlap(state, self, other);
  }
  if (other.start < start && otherEnd < end) {
    return otherEnd - start === allowedOverlap(state, other, self);
  }
  return false;
}

/** The first track of `kind` (in display order) where `[start, start + duration)` is free. */
export function freeTrack(
  state: ProjectState,
  kind: TrackKind,
  start: Micros,
  duration: Micros,
): TrackId | undefined {
  return state.trackOrder.find(
    (id) => state.tracks[id]?.kind === kind && !findOverlap(state, id, start, duration),
  );
}

/** End of the last clip on a track (where a new clip goes by default). */
export function trackEnd(state: ProjectState, trackId: TrackId): Micros {
  const track = state.tracks[trackId];
  let end = 0;
  for (const id of track?.clipIds ?? []) {
    const clip = state.clips[id];
    if (clip) end = Math.max(end, clip.start + clip.duration);
  }
  return end;
}

/** Sorts clip ids by start time. Returns a new array. */
export function sortClipIds(ids: readonly ClipId[], clips: Record<ClipId, Clip>): ClipId[] {
  return [...ids].sort((a, b) => (clips[a]?.start ?? 0) - (clips[b]?.start ?? 0));
}

/**
 * Neighbours of a clip on its track: end of the previous clip and start of the next. A neighbour
 * joined to the clip (overlapping it by a junction's duration) bounds it at its edge ∓ that
 * duration, which is the clip's own edge.
 */
export function neighbourBounds(
  state: ProjectState,
  clip: Clip,
): { prevEnd: Micros; nextStart: Micros } {
  let prevEnd = 0;
  let nextStart = Number.POSITIVE_INFINITY;
  const end = clip.start + clip.duration;
  for (const id of state.tracks[clip.trackId]?.clipIds ?? []) {
    if (id === clip.id) continue;
    const other = state.clips[id];
    if (!other) continue;
    if (other.start < clip.start) {
      const bound = other.start + other.duration - allowedOverlap(state, other, clip);
      if (bound <= clip.start) prevEnd = Math.max(prevEnd, bound);
    } else {
      const bound = other.start + allowedOverlap(state, clip, other);
      if (bound >= end) nextStart = Math.min(nextStart, bound);
    }
  }
  return { prevEnd, nextStart };
}

/**
 * Moves one edge of a clip to `time`, clamped so the clip stays inside its source media,
 * keeps a minimum length, and never overlaps its neighbours. Returns the new clip timing.
 */
export function clampTrim(
  clip: Pick<Clip, "start" | "sourceIn" | "duration">,
  edge: "start" | "end",
  time: Micros,
  limits: TrimLimits,
): Pick<Clip, "start" | "sourceIn" | "duration"> {
  const end = clip.start + clip.duration;
  if (edge === "start") {
    const sourceStart = limits.sourceless ? 0 : clip.start - clip.sourceIn;
    const earliest = Math.max(limits.prevEnd, sourceStart, 0);
    const latest = end - limits.minDuration;
    const start = Math.min(Math.max(time, earliest), latest);
    const delta = start - clip.start;
    const sourceIn = limits.sourceless ? clip.sourceIn : clip.sourceIn + delta;
    return { start, sourceIn, duration: clip.duration - delta };
  }
  const sourceEnd = limits.sourceless
    ? Number.POSITIVE_INFINITY
    : clip.start - clip.sourceIn + limits.mediaDuration;
  const latest = Math.min(limits.nextStart, sourceEnd);
  const earliest = clip.start + limits.minDuration;
  const newEnd = Math.min(Math.max(time, earliest), latest);
  return { start: clip.start, sourceIn: clip.sourceIn, duration: newEnd - clip.start };
}

/** Snaps `time` to the closest candidate within `threshold`, or returns it unchanged. */
export function snapTime(time: Micros, candidates: readonly Micros[], threshold: Micros): Micros {
  let best = time;
  let bestDistance = threshold;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - time);
    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Snaps a moving span by whichever of its edges lands closest to a candidate.
 * Returns the adjusted start.
 */
export function snapSpan(
  start: Micros,
  duration: Micros,
  candidates: readonly Micros[],
  threshold: Micros,
): Micros {
  const snappedStart = snapTime(start, candidates, threshold);
  const snappedEnd = snapTime(start + duration, candidates, threshold);
  const startDelta = snappedStart - start;
  const endDelta = snappedEnd - (start + duration);
  if (startDelta === 0 && endDelta === 0) return start;
  if (startDelta === 0) return start + endDelta;
  if (endDelta === 0) return snappedStart;
  return Math.abs(startDelta) <= Math.abs(endDelta) ? snappedStart : start + endDelta;
}

/**
 * Times worth snapping to: zero, the playhead, every clip edge (except ignored clips) and every
 * junction's cut (the middle of its overlap).
 */
export function snapCandidates(
  state: ProjectState,
  playhead: Micros,
  ignore: ReadonlySet<ClipId> = new Set(),
): Micros[] {
  const candidates = [0, playhead];
  for (const clip of Object.values(state.clips)) {
    if (ignore.has(clip.id)) continue;
    candidates.push(clip.start, clip.start + clip.duration);
  }
  for (const junction of Object.values(state.junctions)) {
    const right = state.clips[junction.rightClipId];
    if (!right || ignore.has(junction.leftClipId) || ignore.has(right.id)) continue;
    candidates.push(right.start + Math.floor(junction.duration / 2));
  }
  return candidates;
}
