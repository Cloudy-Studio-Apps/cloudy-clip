import { produce } from "immer";
import type { StoreApi } from "zustand/vanilla";
import { CommandFailure, type CommandContext, type ModuleContext } from "@/core";
import type { KeyField, KeyTarget } from "@/modules/keyframe";
import {
  RAMP_PATH,
  canChangeSpeed,
  formatOf,
  projectRef,
  rampContentAt,
  rampOf,
  rampTimeAt,
  sourceSpan,
  speedOf,
  type Clip,
  type KeyTrack,
  type ProjectState,
} from "@/modules/project";
import {
  checkLayout,
  commitState,
  junctionKindOf,
  minClipDuration,
  type JunctionKindOf,
} from "@/modules/timeline";
import {
  flattenRamp,
  refuseJoinedEnd,
  resize,
  retime,
  writeRamp,
  writeSpeed,
} from "./logic/retime";
import { RATE, groupsOf } from "./speed.commands";
import type { SpeedView } from "./speed.types";

/** The track as a clip `shift` further along its own content sees it. */
function shifted(track: KeyTrack, shift: number): KeyTrack {
  if (shift === 0) return track;
  return { ...track, keys: track.keys.map((key) => ({ ...key, t: key.t + shift })) };
}

/** The ramp's length for `span` of the file, never past that span. */
function lengthThrough(track: KeyTrack, origin: number, span: number): number {
  const length = rampTimeAt(track, origin, origin + span);
  return rampContentAt(track, origin, length) - origin > span ? length - 1 : length;
}

/** The group on a ramp: each with that track, from its own origin, and the length it takes. */
function onRamp(
  state: ProjectState,
  group: readonly Clip[],
  track: KeyTrack,
  span: number,
  ripple: boolean,
  kindOf: JunctionKindOf,
): ProjectState {
  const clip = group[0]!;
  const origin = clip.animationOrigin ?? 0;
  const length = lengthThrough(track, origin, span);
  if (length < minClipDuration(formatOf(state, clip))) {
    throw new CommandFailure(
      "speed.out_of_range",
      `That ramp would leave clip "${clip.id}" shorter than one frame.`,
      { clipId: clip.id },
    );
  }
  if (!ripple && length !== clip.duration) refuseJoinedEnd(state, group);
  const write = (target: Clip, member: Clip) =>
    writeRamp(target, shifted(track, (member.animationOrigin ?? 0) - origin));
  return resize(state, group, { lengthOf: () => length, write, ripple }, kindOf);
}

/** The group on one rate, the ramp gone, still playing `span` of the file. */
function offRamp(
  state: ProjectState,
  group: readonly Clip[],
  span: number,
  ripple: boolean,
  kindOf: JunctionKindOf,
): ProjectState {
  const rate = speedOf(group[0]!).rate;
  const flat = produce(state, (draft) => {
    for (const clip of group) flattenRamp(draft.clips[clip.id]!, span);
  });
  const current = group.map((clip) => flat.clips[clip.id]!);
  return retime(flat, current, rate, ripple, kindOf).state;
}

/** Whether a linked group already is what a changed track asks of it. */
function settled(group: readonly Clip[], track: KeyTrack | undefined, span: number): boolean {
  const clip = group[0]!;
  return (
    sourceSpan(clip) === span &&
    group.every((one) => rampOf(one) === track && one.duration === clip.duration)
  );
}

/**
 * Speed as a key track: a ramp's keys sit on the file's time, so the clip's part of the file
 * stays and its length follows. Linked clips take the same track and length, in the same step.
 */
export function speedKeys(
  ctx: Pick<ModuleContext, "require">,
  view: StoreApi<SpeedView>,
): KeyTarget {
  const store = () => ctx.require(projectRef).store;
  const rate: KeyField = {
    path: RAMP_PATH,
    label: "Speed",
    blend: "number",
    shared: true,
    min: RATE.min,
    max: RATE.max,
    loops: false,
    read: (clip) => speedOf(clip).rate,
    // The length needs the ramp that just went, so `afterWrite` settles it.
    commitStatic: async (run: CommandContext, clipId, value) =>
      run.mutate(store(), (draft) => {
        const clip = draft.clips[clipId]!;
        writeSpeed(clip, { ...speedOf(clip), rate: Number(value) });
      }),
  };
  return {
    id: "speed.keys",
    fields: (clip) => (canChangeSpeed(store().getState(), clip) ? [rate] : []),
    afterWrite(run, clipId, before) {
      const state = store().getState();
      const clip = state.clips[clipId]!;
      const track = rampOf(clip);
      if (track && speedOf(clip).reversed) {
        throw new CommandFailure(
          "speed.reversed_ramp",
          `Clip "${clipId}" plays backwards, which can't take a speed ramp. Turn Reverse off first.`,
          { clipId },
        );
      }
      const span = sourceSpan(before);
      const group = groupsOf(state, [clipId])[0]!;
      if (settled(group, track, span)) return;
      const { ripple } = view.getState();
      const kindOf = junctionKindOf(run);
      const next = track
        ? onRamp(state, group, track, span, ripple, kindOf)
        : offRamp(state, group, span, ripple, kindOf);
      checkLayout(next, new Set(group.map((one) => one.id)));
      commitState(run, state, next);
    },
  };
}
