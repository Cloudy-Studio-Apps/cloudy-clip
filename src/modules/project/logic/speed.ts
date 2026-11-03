import type { Micros } from "@/core";
import type { Clip, ClipSpeed, KeyTrack, Keyframe, ProjectState } from "../project.types";
import { rampContentAt, rampOf } from "./ramp";

/** How a clip plays until it's changed: normally. */
export const DEFAULT_SPEED: ClipSpeed = { rate: 1, pitchCorrection: true, reversed: false };

/**
 * A clip's speed; the defaults when it has none of its own. A stored speed is whole, but the one
 * of a ramped clip (`animatedClip`) may hold only its keyed rate, so the rest fills in.
 */
export function speedOf(clip: Pick<Clip, "speed">): ClipSpeed {
  const { speed } = clip;
  if (!speed) return DEFAULT_SPEED;
  return speed.reversed === undefined ? { ...DEFAULT_SPEED, ...speed } : speed;
}

/**
 * How much of its file a clip plays in `elapsed` from its first frame: one rate, or a ramp. A
 * ramp comes from its track and never from `speed.rate`, which `animatedClip` overwrites per frame.
 */
export function filePlayed(
  clip: Pick<Clip, "speed" | "animation" | "animationOrigin">,
  elapsed: Micros,
): Micros {
  const ramp = rampOf(clip);
  if (!ramp) return Math.round(elapsed * speedOf(clip).rate);
  const origin = clip.animationOrigin ?? 0;
  return rampContentAt(ramp, origin, elapsed) - origin;
}

/** The part of the file a clip plays, in file time. */
export function sourceSpan(
  clip: Pick<Clip, "duration" | "speed" | "animation" | "animationOrigin">,
): Micros {
  return filePlayed(clip, clip.duration);
}

/**
 * The file's time at a timeline time. The only place clip time meets a rate. A reversed clip
 * starts at the end of its part of the file and runs back to `sourceIn`.
 */
export function sourceTimeAt(
  clip: Pick<Clip, "start" | "sourceIn" | "duration" | "speed" | "animation" | "animationOrigin">,
  time: Micros,
): Micros {
  const span = sourceSpan(clip);
  const played = Math.min(filePlayed(clip, time - clip.start), span);
  return clip.sourceIn + (speedOf(clip).reversed ? span - played : played);
}

/** Where the element playing a clip should be: a reversed copy holds the file end to start. */
export function elementTimeAt(
  clip: Pick<Clip, "start" | "sourceIn" | "duration" | "speed" | "animation" | "animationOrigin">,
  time: Micros,
  fileDuration: Micros,
): Micros {
  const inFile = sourceTimeAt(clip, time);
  return speedOf(clip).reversed ? fileDuration - inFile : inFile;
}

/** Whether a clip's speed can change: it plays a file's time, and isn't a held frame. */
export function canChangeSpeed(state: Pick<ProjectState, "media">, clip: Clip): boolean {
  if (clip.mediaId === undefined || speedOf(clip).rate === 0) return false;
  return state.media[clip.mediaId]?.kind !== "image";
}

/** Whether two keys ramp the same way, `shift` apart. */
function sameKey(a: Keyframe, b: Keyframe, shift: Micros): boolean {
  return (
    a.t + shift === b.t && a.value === b.value && JSON.stringify(a.ease) === JSON.stringify(b.ease)
  );
}

/** Whether two tracks ramp the same way, `shift` apart. */
function sameRamp(a: KeyTrack, b: KeyTrack, shift: Micros): boolean {
  return (
    a.keys.length === b.keys.length && a.keys.every((key, i) => sameKey(key, b.keys[i]!, shift))
  );
}

/** Whether two clips play at the same speed, or the same ramp from their own origins. */
export function sameSpeed(
  a: Pick<Clip, "speed" | "animation" | "animationOrigin">,
  b: Pick<Clip, "speed" | "animation" | "animationOrigin">,
): boolean {
  const [one, other] = [speedOf(a), speedOf(b)];
  const [ramp, otherRamp] = [rampOf(a), rampOf(b)];
  const shift = (b.animationOrigin ?? 0) - (a.animationOrigin ?? 0);
  return (
    one.rate === other.rate &&
    one.pitchCorrection === other.pitchCorrection &&
    one.reversed === other.reversed &&
    (ramp && otherRamp ? sameRamp(ramp, otherRamp, shift) : ramp === otherRamp)
  );
}
