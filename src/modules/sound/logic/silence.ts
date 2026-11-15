import type { Micros } from "@/core";
import {
  clipEnd,
  partnersOf,
  sourceSpan,
  speedOf,
  type Clip,
  type ProjectState,
  type Track,
} from "@/modules/project";
import type { Cut, SilenceParams } from "../sound.tools.types";
import { timelineTimeOf } from "./beats";

/** What Strip silence starts from: quieter than -35 dB for 0.4 s is silence, 0.1 s of quiet is kept each side. */
export const SILENCE_DEFAULTS: SilenceParams = { thresholdDb: -35, minMs: 400, padMs: 100 };

/**
 * The cuts a clip's silent stretches make, in timeline time, in order. `stretches` are in file
 * microseconds (what `silencedetect` found over the part the clip plays); each goes through the
 * clip's trims, speed, ramp and reverse (`timeOfContent`). A stretch shorter than `minMs` is kept;
 * `padMs` of quiet stays on each side of a cut, and a cut the padding eats whole is dropped. A
 * held frame has no sound, so no cuts.
 */
export function cutsFor(
  clip: Clip,
  stretches: readonly (readonly [Micros, Micros])[],
  padMs: number,
  minMs = 0,
): Cut[] {
  if (speedOf(clip).rate === 0) return [];
  const pad = Math.round(padMs * 1000);
  const low = clip.sourceIn;
  const high = low + sourceSpan(clip);
  const cuts: Cut[] = [];
  for (const [from, to] of stretches) {
    if (to - from < minMs * 1000) continue;
    const a = Math.max(from, low);
    const b = Math.min(to, high);
    if (b <= a) continue;
    const x = timelineTimeOf(clip, a);
    const y = timelineTimeOf(clip, b);
    const start = Math.round(Math.min(x, y)) + pad;
    const end = Math.round(Math.max(x, y)) - pad;
    if (end > start) cuts.push({ start, end });
  }
  return cuts.sort((p, q) => p.start - q.start);
}

/**
 * The tracks that would drift when closing the gaps of `clips`' cuts: tracks that hold something
 * after the first cut but aren't among the clips' own tracks (or their linked clips'), so they keep
 * their time while the cut tracks move earlier.
 */
export function driftingTracks(state: ProjectState, clips: readonly Clip[], cuts: readonly Cut[]) {
  if (clips.length === 0 || cuts.length === 0) return [];
  const own = new Set(clips.flatMap((c) => [c, ...partnersOf(state, c.id)]).map((c) => c.trackId));
  const first = Math.min(...cuts.map((c) => c.start));
  const composition = Object.values(state.compositions).find((c) =>
    c.trackOrder.includes(clips[0]!.trackId),
  );
  const drifting: Track[] = [];
  for (const id of composition?.trackOrder ?? []) {
    const track = state.tracks[id];
    if (!track || own.has(id)) continue;
    if (track.clipIds.some((clipId) => clipEnd(state.clips[clipId]!) > first)) drifting.push(track);
  }
  return drifting;
}
