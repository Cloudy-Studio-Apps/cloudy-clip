import type { KeybindingAction, Micros } from "@/core";
import type { Clip, ProjectState } from "@/modules/project";
import { moveClip, neighbourBounds, trimClip } from "@/modules/timeline";
import { clampCue } from "./logic/time";
import type { CueTimeField } from "./subtitle.types";

/**
 * The timeline command that sets one time of a cue (a trim of an edge, or a move), kept between
 * its neighbours and at least `MIN_CUE` long; `clamped` says the value had to change. `action` is
 * null when nothing would change. The cue list's times and the timing keys both go through it.
 */
export function cueTimeAction(
  state: ProjectState,
  clip: Clip,
  field: CueTimeField | "move",
  value: Micros,
): { action: KeybindingAction | null; clamped: boolean } {
  const { time, clamped } = clampCue(clip, neighbourBounds(state, clip), field, value);
  const end = clip.start + clip.duration;
  if (field === "move") {
    if (time === clip.start) return { action: null, clamped };
    return { action: { command: moveClip.id, input: { clipId: clip.id, start: time } }, clamped };
  }
  const edge = field === "start" ? "start" : "end";
  const to = field === "length" ? clip.start + time : time;
  if (to === (edge === "start" ? clip.start : end)) return { action: null, clamped };
  return { action: { command: trimClip.id, input: { clipId: clip.id, edge, time: to } }, clamped };
}
