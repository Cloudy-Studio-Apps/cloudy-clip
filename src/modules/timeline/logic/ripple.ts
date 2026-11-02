import type { Micros } from "@/core";
import {
  clipEnd,
  partnersOf,
  type Clip,
  type ClipId,
  type ClipMove,
  type ProjectState,
} from "@/modules/project";

type Span = [start: Micros, end: Micros];

/** The parts of `spans` that none of `covered` lies over, merged and in order. */
function uncovered(spans: readonly Span[], covered: readonly Span[]): Span[] {
  let free = [...spans].sort((a, b) => a[0] - b[0]);
  for (const [from, to] of covered) {
    free = free.flatMap(([start, end]): Span[] => {
      if (to <= start || from >= end) return [[start, end]];
      const parts: Span[] = [];
      if (start < from) parts.push([start, from]);
      if (to < end) parts.push([to, end]);
      return parts;
    });
  }
  const merged: Span[] = [];
  for (const [start, end] of free) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** How far each kept clip of a track that loses clips moves back. */
function trackShifts(clips: readonly Clip[], doomed: ReadonlySet<ClipId>): Map<ClipId, Micros> {
  const span = (clip: Clip): Span => [clip.start, clipEnd(clip)];
  const kept = clips.filter((clip) => !doomed.has(clip.id));
  const freed = uncovered(clips.filter((c) => doomed.has(c.id)).map(span), kept.map(span));
  const shifts = new Map<ClipId, Micros>();
  for (const clip of kept) {
    const before = freed.filter(([, end]) => end <= clip.start);
    shifts.set(
      clip.id,
      before.reduce((sum, [start, end]) => sum + end - start, 0),
    );
  }
  return shifts;
}

/**
 * What moves when clips are ripple deleted: on each track that loses a clip, what follows moves
 * back by the time the deleted clips freed (what another clip still covers isn't freed, and gaps
 * already there stay). A linked group moves together by the smallest shift among its clips on
 * those tracks. `doomed` holds the partners too.
 */
export function rippleDeleteMoves(state: ProjectState, doomed: ReadonlySet<ClipId>): ClipMove[] {
  const shifts = new Map<ClipId, Micros>();
  for (const track of Object.values(state.tracks)) {
    if (!track.clipIds.some((id) => doomed.has(id))) continue;
    const clips = track.clipIds.flatMap((id) => state.clips[id] ?? []);
    for (const [id, shift] of trackShifts(clips, doomed)) shifts.set(id, shift);
  }
  const moves = new Map<ClipId, ClipMove>();
  for (const id of shifts.keys()) {
    const group = [state.clips[id]!, ...partnersOf(state, id)];
    const known = group.flatMap((clip) => shifts.get(clip.id) ?? []);
    const shift = Math.min(...known);
    if (shift === 0) continue;
    for (const clip of group) moves.set(clip.id, { clipId: clip.id, start: clip.start - shift });
  }
  return [...moves.values()];
}
