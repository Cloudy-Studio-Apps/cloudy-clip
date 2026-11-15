import { createId } from "@/core";
import type { Micros } from "@/core";
import type { KeyEase, KeyTrack, KeyValue, Keyframe, SpanPoint } from "../project.types";
import { trackValue } from "./animate";

/** How far outside a written span its edges are held at the old level (µs). */
const EDGE: Micros = 1;
/** A written span runs straight between its points, whatever eased before it. */
const LINEAR: KeyEase = { kind: "linear" };

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

/**
 * `old` with its keys from `from` to `to` (both included, in the keys' own time) replaced by
 * `points`, each running straight to the next, while the track outside the span plays as before:
 * a key `EDGE` (1 µs) before `from` (none before 0) and one after `to` hold the value `old` had
 * there (`fallback`, the static value, when it has no keys), the one after easing as `old` did
 * there, so the change is a step at the span's edges. No anchor where `old` already has a key.
 * With no points the span is cleared. Points on the same time: the later wins. Drawing strokes and
 * fader passes write this way, on a track's volume line and on a clip's keys alike.
 */
export function writeSpan(
  old: KeyTrack,
  from: Micros,
  to: Micros,
  points: readonly SpanPoint[],
  fallback: KeyValue,
): KeyTrack {
  const levelAt = (t: Micros) => (old.keys.length > 0 ? trackValue(old, t) : fallback);
  let next: KeyTrack = { ...old, keys: old.keys.filter((key) => key.t < from || key.t > to) };
  for (const point of [...points].sort((a, b) => a.t - b.t)) {
    next = writeKey(next, point.t, point.value, 0, LINEAR);
  }
  const taken = (t: Micros) => old.keys.some((key) => key.t === t);
  const before = from - EDGE;
  if (before >= 0 && !taken(before)) next = writeKey(next, before, levelAt(before), 0, LINEAR);
  const after = to + EDGE;
  if (!taken(after)) {
    const ease = old.keys.filter((key) => key.t < after).at(-1)?.ease ?? LINEAR;
    next = writeKey(next, after, levelAt(after), 0, ease);
  }
  return next;
}
