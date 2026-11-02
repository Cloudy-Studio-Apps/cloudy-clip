import type { Micros } from "@/core";
import type { Clip, ClipSpeed, ProjectState } from "../project.types";

/** How a clip plays until it's changed: normally. */
export const DEFAULT_SPEED: ClipSpeed = { rate: 1, pitchCorrection: true, reversed: false };

/** A clip's speed; the defaults when it has none of its own. */
export function speedOf(clip: Pick<Clip, "speed">): ClipSpeed {
  return clip.speed ?? DEFAULT_SPEED;
}

/** The part of the file a clip plays, in file time. */
export function sourceSpan(clip: Pick<Clip, "duration" | "speed">): Micros {
  return Math.round(clip.duration * speedOf(clip).rate);
}

/** The file's time at a timeline time. The only place clip time meets a rate. */
export function sourceTimeAt(
  clip: Pick<Clip, "start" | "sourceIn" | "duration" | "speed">,
  time: Micros,
): Micros {
  const played = Math.round((time - clip.start) * speedOf(clip).rate);
  return clip.sourceIn + Math.min(played, sourceSpan(clip));
}

/** Whether a clip's speed can change: it plays a file's time, and isn't a held frame. */
export function canChangeSpeed(state: Pick<ProjectState, "media">, clip: Clip): boolean {
  if (clip.mediaId === undefined || speedOf(clip).rate === 0) return false;
  return state.media[clip.mediaId]?.kind !== "image";
}

/** Whether two clips play at the same speed. */
export function sameSpeed(a: Pick<Clip, "speed">, b: Pick<Clip, "speed">): boolean {
  const [one, other] = [speedOf(a), speedOf(b)];
  return (
    one.rate === other.rate &&
    one.pitchCorrection === other.pitchCorrection &&
    one.reversed === other.reversed
  );
}
