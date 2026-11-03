import type { Micros } from "@/core";
import type { Clip, Timed } from "../project.types";
import { rampOf, rampRate, rampTimeAt } from "./ramp";
import { filePlayed, speedOf } from "./speed";

/**
 * A clip's own time at a timeline time: how long its picture has played since its first frame,
 * from `animationOrigin`. It runs forward on a reversed clip, keeps running on a held frame and
 * follows a ramp, and is not clamped, since a key may sit outside the clip's span.
 */
export function contentTime(clip: Timed, time: Micros): Micros {
  const since = time - clip.start;
  return (clip.animationOrigin ?? 0) + (speedOf(clip).rate === 0 ? since : filePlayed(clip, since));
}

/** The timeline time at which the clip's content is at `t`: the inverse of `contentTime`. */
export function timeOfContent(clip: Timed, t: Micros): Micros {
  const origin = clip.animationOrigin ?? 0;
  const ramp = rampOf(clip);
  if (ramp) return clip.start + rampTimeAt(ramp, origin, t);
  const { rate } = speedOf(clip);
  const played = t - origin;
  return clip.start + (rate === 0 ? played : Math.round(played / rate));
}

/** The rate playing at a timeline time, with or without a ramp. */
export function rateAt(clip: Timed, time: Micros): number {
  const ramp = rampOf(clip);
  return ramp ? rampRate(ramp, contentTime(clip, time)) : speedOf(clip).rate;
}

/** A timeline time brought into the clip's frames: its first microsecond to its last. */
export function clampToClip(clip: Pick<Clip, "start" | "duration">, time: Micros): Micros {
  return Math.max(clip.start, Math.min(time, clip.start + clip.duration - 1));
}
