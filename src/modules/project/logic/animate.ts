import type { Micros } from "@/core";
import type { Clip, KeyTrack, KeyValue, Keyframe } from "../project.types";
import { easeProgress } from "./ease";
import { contentTime } from "./content";

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Where a time falls once the track loops or ping-pongs after its last key. */
function folded(track: KeyTrack, t: Micros): Micros {
  const first = track.keys[0];
  const last = track.keys[track.keys.length - 1];
  if (!first || !last || !track.after || t <= last.t) return t;
  const span = last.t - first.t;
  if (span <= 0) return t;
  const into = (t - first.t) % (track.after === "loop" ? span : 2 * span);
  if (track.after === "loop") return first.t + into;
  return first.t + (into <= span ? into : 2 * span - into);
}

function channels(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

function blended(track: KeyTrack, a: Keyframe, b: Keyframe, p: number): KeyValue {
  if (track.blend === "number" && typeof a.value === "number" && typeof b.value === "number") {
    const value = a.value + (b.value - a.value) * p;
    const floor = track.min === undefined ? value : Math.max(track.min, value);
    return track.max === undefined ? floor : Math.min(track.max, floor);
  }
  if (track.blend === "color" && typeof a.value === "string" && typeof b.value === "string") {
    const from = channels(a.value);
    const to = channels(b.value);
    if (from && to) {
      const hex = from.map((c, i) =>
        Math.min(255, Math.max(0, Math.round(c + (to[i]! - c) * p)))
          .toString(16)
          .padStart(2, "0"),
      );
      return `#${hex.join("")}`;
    }
  }
  return a.value;
}

/**
 * The value of a track at a time on the clip's content. Before the first key and after the last
 * (unless it loops) the nearest key's value holds. Numbers and colors blend along the left key's
 * ease and clamp to `min`/`max`; everything else steps to the left key.
 */
export function trackValue(track: KeyTrack, t: Micros): KeyValue {
  const keys = track.keys;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) throw new Error("A key track needs at least one key");
  const at = folded(track, t);
  if (at <= first.t) return first.value;
  if (at >= last.t) return last.value;
  let i = keys.length - 2;
  while (i > 0 && keys[i]!.t > at) i--;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  if (track.blend === "step") return a.value;
  return blended(track, a, b, easeProgress(a.ease, (at - a.t) / (b.t - a.t)));
}

/** `root` with `value` at `path`, copying only what lies along it. */
function withPath(
  root: Record<string, unknown>,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path;
  if (head === undefined) return root;
  const child = root[head];
  return {
    ...root,
    [head]: rest.length === 0 ? value : withPath(isPlain(child) ? child : {}, rest, value),
  };
}

/**
 * The clip as it is at a timeline time: every keyed value written in place, shared ones under
 * their own key and the rest in `props`. The saved clip is untouched; one with nothing keyed comes
 * back as itself, and a track without keys is skipped. Shared values may come out partial
 * (`clipTransform` fills in the rest).
 */
export function animatedClip(clip: Clip, time: Micros): Clip {
  const entries = Object.entries(clip.animation ?? {});
  if (entries.length === 0) return clip;
  const t = contentTime(clip, time);
  let result: Record<string, unknown> = { ...clip };
  let props: Record<string, unknown> = clip.props;
  for (const [path, track] of entries) {
    // A track with no keys has no value; it's skipped rather than breaking the frame.
    if (track.keys.length === 0) continue;
    const value = trackValue(track, t);
    if (track.shared) result = withPath(result, path.split("."), value);
    else props = withPath(props, path.split("."), value);
  }
  return { ...result, props } as unknown as Clip;
}
