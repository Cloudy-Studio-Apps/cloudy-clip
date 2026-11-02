import type { Micros } from "@/core";
import {
  allowedOverlap,
  compositionClips,
  frameDuration,
  junctionBetween,
  orderedJunctions,
  partnersOf,
  type Clip,
  type ClipId,
  type Composition,
  type CompositionId,
  type ProjectFormat,
  type ProjectState,
  type TrackId,
  type TrackKind,
  contentTime,
  sourceSpan,
  speedOf,
} from "@/modules/project";
import type { JunctionKindOf, TrimEdge, TrimLimits } from "../timeline.types";
import { overlapAccepted } from "./joined";

/** Smallest clip length allowed: one frame at the composition's frame rate. */
export function minClipDuration(format: ProjectFormat): Micros {
  return frameDuration(format);
}

/**
 * Returns the first clip on the track overlapping `[start, start + duration)`, ignoring some.
 * When the span is `self` placed there, a neighbour it overlaps at one edge by exactly the
 * allowed overlap (a junction joining them, junction rule 8) is not in the way; with `kindOf`, any
 * overlap the junction's kind accepts (the move command resizes the junction) is not in the way.
 */
export function findOverlap(
  state: ProjectState,
  trackId: TrackId,
  start: Micros,
  duration: Micros,
  ignore: ReadonlySet<ClipId> = new Set(),
  self?: Clip,
  kindOf?: JunctionKindOf,
): Clip | undefined {
  const end = start + duration;
  const track = state.tracks[trackId];
  if (!track) return undefined;
  for (const id of track.clipIds) {
    if (ignore.has(id)) continue;
    const clip = state.clips[id];
    if (!clip || !(clip.start < end && start < clip.start + clip.duration)) continue;
    if (self && joinedOverlap(state, self, start, end, clip, kindOf)) continue;
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
  kindOf?: JunctionKindOf,
): boolean {
  const otherEnd = other.start + other.duration;
  const accepted = (left: Clip, right: Clip, overlap: Micros) =>
    kindOf
      ? overlapAccepted(state, left, right, overlap, kindOf)
      : overlap === allowedOverlap(state, left, right);
  if (start < other.start && end < otherEnd) return accepted(self, other, end - other.start);
  if (other.start < start && otherEnd < end) return accepted(other, self, otherEnd - start);
  return false;
}

/** The first track of `kind` (in display order) where `[start, start + duration)` is free. */
export function freeTrack(
  state: ProjectState,
  composition: Composition,
  kind: TrackKind,
  start: Micros,
  duration: Micros,
): TrackId | undefined {
  return composition.trackOrder.find(
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
 * duration, which is the clip's own edge. With `rippleEdge`, a neighbour joined on that edge
 * doesn't bound it at all: a trim of a joined edge ripples that neighbour along (junction rule 10).
 */
export function neighbourBounds(
  state: ProjectState,
  clip: Clip,
  rippleEdge?: TrimEdge,
): { prevEnd: Micros; nextStart: Micros } {
  let prevEnd = 0;
  let nextStart = Number.POSITIVE_INFINITY;
  const end = clip.start + clip.duration;
  for (const id of state.tracks[clip.trackId]?.clipIds ?? []) {
    if (id === clip.id) continue;
    const other = state.clips[id];
    if (!other) continue;
    if (other.start < clip.start) {
      if (rippleEdge === "start" && joined(state, other, clip)) continue;
      const bound = other.start + other.duration - allowedOverlap(state, other, clip);
      if (bound <= clip.start) prevEnd = Math.max(prevEnd, bound);
    } else {
      if (rippleEdge === "end" && joined(state, clip, other)) continue;
      const bound = other.start + allowedOverlap(state, clip, other);
      if (bound >= end) nextStart = Math.min(nextStart, bound);
    }
  }
  return { prevEnd, nextStart };
}

/** A junction joins `left` and `right`, or (junction rule 4) a partner of each. */
function joined(state: ProjectState, left: Clip, right: Clip): boolean {
  if (junctionBetween(state, left.id, right.id)) return true;
  const rightPartners = partnersOf(state, right.id);
  return partnersOf(state, left.id).some((pl) =>
    rightPartners.some((pr) => junctionBetween(state, pl.id, pr.id)),
  );
}

/**
 * Moves one edge of a clip to `time`, clamped so the clip stays inside its source media,
 * keeps a minimum length, and never overlaps its neighbours. Returns the new clip timing, and for
 * a clip with keys, the `animationOrigin` that keeps them on the picture they were set on.
 */
export function clampTrim(
  clip: Pick<Clip, "start" | "sourceIn" | "duration" | "speed" | "animation" | "animationOrigin">,
  edge: "start" | "end",
  time: Micros,
  limits: TrimLimits,
): Pick<Clip, "start" | "sourceIn" | "duration" | "animationOrigin"> {
  const end = clip.start + clip.duration;
  const { rate, reversed } = speedOf(clip);
  // The file's time left on each side of the clip, as it plays.
  const fileBefore = clip.sourceIn;
  const fileAfter = limits.mediaDuration - clip.sourceIn - sourceSpan(clip);
  const roomBefore = reversed ? fileAfter : fileBefore;
  const roomAfter = reversed ? fileBefore : fileAfter;
  if (edge === "start") {
    const sourceStart = limits.sourceless ? 0 : clip.start - Math.floor(roomBefore / rate);
    const earliest = Math.max(limits.prevEnd, sourceStart, 0);
    const latest = end - limits.minDuration;
    const start = Math.min(Math.max(time, earliest), latest);
    const delta = start - clip.start;
    const moved = clip.sourceIn + Math.round(delta * rate);
    const sourceIn = limits.sourceless || reversed ? clip.sourceIn : Math.max(0, moved);
    return {
      start,
      sourceIn,
      duration: clip.duration - delta,
      ...(clip.animation && { animationOrigin: contentTime(clip, start) }),
    };
  }
  const sourceEnd = limits.sourceless
    ? Number.POSITIVE_INFINITY
    : end + Math.floor(roomAfter / rate);
  const latest = Math.min(limits.nextStart, sourceEnd);
  const earliest = clip.start + limits.minDuration;
  const newEnd = Math.min(Math.max(time, earliest), latest);
  const sourceIn = reversed
    ? Math.max(0, clip.sourceIn - Math.round((newEnd - end) * rate))
    : clip.sourceIn;
  return { start: clip.start, sourceIn, duration: newEnd - clip.start };
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
  compositionId: CompositionId,
  playhead: Micros,
  ignore: ReadonlySet<ClipId> = new Set(),
): Micros[] {
  const candidates = [0, playhead];
  for (const clip of compositionClips(state, compositionId)) {
    if (ignore.has(clip.id)) continue;
    candidates.push(clip.start, clip.start + clip.duration);
  }
  for (const junction of orderedJunctions(state, compositionId)) {
    const right = state.clips[junction.rightClipId];
    if (!right || ignore.has(junction.leftClipId) || ignore.has(right.id)) continue;
    candidates.push(right.start + Math.floor(junction.duration / 2));
  }
  return candidates;
}

/**
 * What a new track can be in a gap between tracks: video above, audio below, both where they meet.
 * Missing means the edge of the list.
 */
export function insertKinds(above: TrackKind | undefined, below: TrackKind | undefined) {
  const kinds: TrackKind[] = [];
  if (above !== "audio") kinds.push("video");
  if (below !== "video") kinds.push("audio");
  return kinds.length > 0 ? kinds : (["video", "audio"] as TrackKind[]);
}
