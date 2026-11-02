import type { Micros } from "@/core";
import type { Clip } from "../project.types";
import { speedOf } from "./speed";

/** What the content functions read of a clip. */
type Timed = Pick<Clip, "start" | "duration" | "speed" | "animationOrigin">;

/**
 * A clip's own time at a timeline time: how long its picture has played since its first frame,
 * from `animationOrigin`. It runs forward on a reversed clip and keeps running on a held frame,
 * and is not clamped, since a key may sit outside the clip's span.
 */
export function contentTime(clip: Timed, time: Micros): Micros {
  const { rate } = speedOf(clip);
  const played = rate === 0 ? time - clip.start : Math.round((time - clip.start) * rate);
  return (clip.animationOrigin ?? 0) + played;
}

/** The timeline time at which the clip's content is at `t`: the inverse of `contentTime`. */
export function timeOfContent(clip: Timed, t: Micros): Micros {
  const { rate } = speedOf(clip);
  const played = t - (clip.animationOrigin ?? 0);
  return clip.start + (rate === 0 ? played : Math.round(played / rate));
}

/** A timeline time brought into the clip's frames: its first microsecond to its last. */
export function clampToClip(clip: Pick<Clip, "start" | "duration">, time: Micros): Micros {
  return Math.max(clip.start, Math.min(time, clip.start + clip.duration - 1));
}
