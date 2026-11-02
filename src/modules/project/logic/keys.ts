import { createId } from "@/core";
import type { Micros } from "@/core";
import type { KeyEase, KeyTrack, KeyValue, Keyframe } from "../project.types";

/**
 * Writes a value at a time. A key within `tolerance` is updated in place (it keeps its id, time
 * and ease, and takes `ease` when one is given); otherwise a key is inserted, easing like the key
 * before it unless `ease` is given.
 */
export function writeKey(
  track: KeyTrack,
  t: Micros,
  value: KeyValue,
  tolerance: Micros,
  ease?: KeyEase,
): KeyTrack {
  let nearest: Keyframe | undefined;
  for (const key of track.keys) {
    const gap = Math.abs(key.t - t);
    if (gap <= tolerance && (!nearest || gap < Math.abs(nearest.t - t))) nearest = key;
  }
  if (nearest) {
    const hit = nearest;
    return {
      ...track,
      keys: track.keys.map((key) =>
        key === hit ? { ...key, value, ...(ease ? { ease } : {}) } : key,
      ),
    };
  }
  const before = track.keys.filter((key) => key.t < t).at(-1);
  const inherited = ease ?? before?.ease;
  const added: Keyframe = {
    id: createId("key"),
    t,
    value,
    ...(inherited ? { ease: inherited } : {}),
  };
  return { ...track, keys: [...track.keys, added].sort((a, b) => a.t - b.t) };
}

/**
 * Sets the new time of each key in `moves` (by id). A key that was not moved and sits within
 * `tolerance` of where a moved key lands is removed, so the moved key replaces it.
 */
export function moveTrackKeys(
  track: KeyTrack,
  moves: ReadonlyMap<string, Micros>,
  tolerance: Micros,
): KeyTrack {
  const landings = [...moves.entries()]
    .filter(([id]) => track.keys.some((key) => key.id === id))
    .map(([, t]) => t);
  const keys = track.keys
    .filter((key) => moves.has(key.id) || !landings.some((t) => Math.abs(t - key.t) <= tolerance))
    .map((key) => {
      const t = moves.get(key.id);
      return t === undefined ? key : { ...key, t };
    })
    .sort((a, b) => a.t - b.t);
  return { ...track, keys };
}

/** The track without the keys in `ids`, or undefined when none is left. */
export function withoutKeys(track: KeyTrack, ids: ReadonlySet<string>): KeyTrack | undefined {
  const keys = track.keys.filter((key) => !ids.has(key.id));
  return keys.length > 0 ? { ...track, keys } : undefined;
}

/** The tracks `drop` does not name, or undefined when none is left. */
export function withoutTracks(
  animation: Record<string, KeyTrack> | undefined,
  drop: (path: string, track: KeyTrack) => boolean,
): Record<string, KeyTrack> | undefined {
  if (!animation) return undefined;
  const kept = Object.entries(animation).filter(([path, track]) => !drop(path, track));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

/** The same segment played backwards: a bezier is reflected, the other eases stay as they are. */
export function mirrorEase(ease: KeyEase | undefined): KeyEase | undefined {
  if (ease?.kind !== "bezier") return ease;
  return { kind: "bezier", x1: 1 - ease.x2, y1: 1 - ease.y2, x2: 1 - ease.x1, y2: 1 - ease.y1 };
}
