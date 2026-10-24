import type { Micros } from "@/core";
import type { Clip, ClipId, ProjectState, TrackId } from "@/modules/project";

/** Smallest clip length allowed: one frame at the project frame rate. */
export function minClipDuration(state: ProjectState): Micros {
  return Math.ceil(1_000_000 / state.format.fps);
}

/** Returns the first clip on the track overlapping `[start, start + duration)`, ignoring some. */
export function findOverlap(
  state: ProjectState,
  trackId: TrackId,
  start: Micros,
  duration: Micros,
  ignore: ReadonlySet<ClipId> = new Set(),
): Clip | undefined {
  const end = start + duration;
  const track = state.tracks[trackId];
  if (!track) return undefined;
  for (const id of track.clipIds) {
    if (ignore.has(id)) continue;
    const clip = state.clips[id];
    if (clip && clip.start < end && start < clip.start + clip.duration) return clip;
  }
  return undefined;
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

/** Neighbours of a clip on its track: end of the previous clip and start of the next. */
export function neighbourBounds(
  state: ProjectState,
  clip: Clip,
): { prevEnd: Micros; nextStart: Micros } {
  let prevEnd = 0;
  let nextStart = Number.POSITIVE_INFINITY;
  for (const id of state.tracks[clip.trackId]?.clipIds ?? []) {
    if (id === clip.id) continue;
    const other = state.clips[id];
    if (!other) continue;
    const otherEnd = other.start + other.duration;
    if (otherEnd <= clip.start) prevEnd = Math.max(prevEnd, otherEnd);
    else if (other.start >= clip.start + clip.duration)
      nextStart = Math.min(nextStart, other.start);
  }
  return { prevEnd, nextStart };
}

/** Limits that apply when trimming a clip. */
export interface TrimLimits {
  /** Length of the source media; `Infinity` if unknown. */
  mediaDuration: Micros;
  minDuration: Micros;
  prevEnd: Micros;
  nextStart: Micros;
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
    const earliest = Math.max(limits.prevEnd, clip.start - clip.sourceIn, 0);
    const latest = end - limits.minDuration;
    const start = Math.min(Math.max(time, earliest), latest);
    const delta = start - clip.start;
    return { start, sourceIn: clip.sourceIn + delta, duration: clip.duration - delta };
  }
  const sourceEnd = clip.start - clip.sourceIn + limits.mediaDuration;
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

/** Times worth snapping to: zero, the playhead, and every clip edge (except ignored clips). */
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
  return candidates;
}
