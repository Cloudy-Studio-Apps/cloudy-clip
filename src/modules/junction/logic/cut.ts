import type { Micros } from "@/core";
import {
  allowedOverlap,
  type Clip,
  type ClipId,
  type ProjectState,
  type TrackId,
} from "@/modules/project";
import type { Cut } from "../junction.types";

/** Adjacent pairs of a track, in time order, that touch or overlap by their junction. */
function cutsOf(state: ProjectState, trackId: TrackId): { cut: Cut; time: Micros }[] {
  const track = state.tracks[trackId];
  if (!track) return [];
  const clips = track.clipIds
    .map((id) => state.clips[id])
    .filter((c): c is Clip => c !== undefined)
    .sort((a, b) => a.start - b.start);
  const cuts: { cut: Cut; time: Micros }[] = [];
  for (let i = 0; i + 1 < clips.length; i++) {
    const left = clips[i]!;
    const right = clips[i + 1]!;
    const d = left.start + left.duration - right.start;
    if (d < 0) continue;
    if (d > 0 && d !== allowedOverlap(state, left, right)) continue;
    cuts.push({ cut: { trackId, left, right }, time: right.start + d / 2 });
  }
  return cuts;
}

/** The cut between two clips that touch, or overlap by their junction, nearest to `time` within `tolerance`. */
export function cutNear(
  state: ProjectState,
  trackId: TrackId,
  time: Micros,
  tolerance: Micros,
): Cut | undefined {
  let best: Cut | undefined;
  let bestDistance = Infinity;
  for (const { cut, time: at } of cutsOf(state, trackId)) {
    const distance = Math.abs(time - at);
    if (distance <= tolerance && distance < bestDistance) {
      best = cut;
      bestDistance = distance;
    }
  }
  return best;
}

/** The cut at the end of a clip (its right neighbour touching it), if any. */
export function cutAfter(state: ProjectState, clipId: ClipId): Cut | undefined {
  const clip = state.clips[clipId];
  if (!clip) return undefined;
  return cutsOf(state, clip.trackId)
    .map(({ cut }) => cut)
    .find((cut) => cut.left.id === clipId);
}
