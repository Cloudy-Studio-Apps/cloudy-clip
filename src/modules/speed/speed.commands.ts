import { produce } from "immer";
import { z } from "zod";
import { CommandFailure, createId, defineCommand, type CommandContext } from "@/core";
import { previewRef } from "@/modules/preview";
import {
  DEFAULT_SPEED,
  applyMoves,
  canChangeSpeed,
  partnersOf,
  projectRef,
  rippleMoves,
  sourceSpan,
  sourceTimeAt,
  speedOf,
  type Clip,
  type ProjectState,
} from "@/modules/project";
import { checkLayout, commitState, junctionKindOf, sortClipIds, splitAt } from "@/modules/timeline";
import { retime, writeSpeed } from "./logic/retime";
import type { RetimedClip, SpeedChange } from "./speed.types";

const RATE = { min: 0.1, max: 10 };
const FREEZE_LENGTH = 3_000_000;

/** The clips as linked groups, earliest first. Fails unless all of them can change speed. */
function groupsOf(state: ProjectState, clipIds: readonly string[]): Clip[][] {
  const seen = new Set<string>();
  const groups: Clip[][] = [];
  for (const id of clipIds) {
    const clip = state.clips[id];
    if (!clip) throw new CommandFailure("speed.clip_not_found", `No clip with id "${id}"`);
    if (seen.has(id)) continue;
    const group = [clip, ...partnersOf(state, id)];
    for (const one of group) {
      seen.add(one.id);
      if (!canChangeSpeed(state, one)) {
        throw new CommandFailure(
          "speed.unsupported",
          `Clip "${one.id}" doesn't play a video or sound file, so it has no speed.`,
          { clipId: one.id },
        );
      }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => a[0]!.start - b[0]!.start);
}

/** The rate a typed length asks of a clip. */
function rateFor(clip: Clip, duration: number): number {
  const rate = sourceSpan(clip) / duration;
  if (rate < RATE.min || rate > RATE.max) {
    throw new CommandFailure(
      "speed.out_of_range",
      `That length needs a speed of ${rate.toFixed(2)}x. Speed goes from ${RATE.min}x to ${RATE.max}x.`,
    );
  }
  return rate;
}

/** Applies a change to every group, as one undo step. */
function change(ctx: CommandContext, clipIds: readonly string[], input: SpeedChange) {
  const state = ctx.require(projectRef).store.getState();
  const kindOf = junctionKindOf(ctx);
  const groups = groupsOf(state, clipIds);
  let next = state;
  const clips: RetimedClip[] = [];
  for (const group of groups) {
    const ids = group.map((clip) => clip.id);
    if (input.pitchCorrection !== undefined || input.reversed !== undefined) {
      next = produce(next, (draft) => {
        for (const id of ids) {
          const clip = draft.clips[id]!;
          writeSpeed(clip, {
            ...speedOf(clip),
            ...(input.pitchCorrection !== undefined && { pitchCorrection: input.pitchCorrection }),
            ...(input.reversed !== undefined && { reversed: input.reversed }),
          });
        }
      });
    }
    if (input.rate) {
      const current = ids.map((id) => next.clips[id]!);
      const wanted = input.rate(current[0]!);
      next = retime(next, current, wanted, input.ripple, kindOf).state;
    }
    for (const id of ids) {
      const clip = next.clips[id]!;
      clips.push({ id, rate: speedOf(clip).rate, duration: clip.duration });
    }
  }
  checkLayout(next, new Set(clips.map((clip) => clip.id)));
  commitState(ctx, state, next);
  return { clips };
}

const clipIds = z.array(z.string()).min(1);
const ripple = z.boolean().default(true);

/** Changes how fast clips play. */
export const setSpeed = defineCommand({
  id: "speed.set",
  label: "Change speed",
  description:
    "Changes how clips play their file: rate (0.1 to 10, 1 is normal) or duration (a new length in microseconds, turned into a rate), pitchCorrection (keeps voices at their pitch) and reversed. Linked clips take the same speed. A clip keeps its start and its part of the file, so its length changes. ripple (default true) moves what follows on the track with it, and junctions shrink as for a trim; false leaves everything else in place, so a slower clip stops at the next one and the rate returned is the one applied. Fails with speed.unsupported (only video and sound files have a speed), speed.out_of_range, speed.joined (ripple off with a junction on the clip's end) or timeline.overlap. Returns { clips: [{ id, rate, duration }] }.",
  undoable: true,
  input: z
    .object({
      clipIds,
      rate: z.number().min(RATE.min).max(RATE.max).optional(),
      duration: z.number().int().positive().optional().describe("Microseconds"),
      pitchCorrection: z.boolean().optional(),
      reversed: z.boolean().optional(),
      ripple,
    })
    .refine((input) => input.rate === undefined || input.duration === undefined, {
      message: "Pass rate or duration, not both",
    }),
  run(ctx, { clipIds, rate, duration, pitchCorrection, reversed, ripple }) {
    return change(ctx, clipIds, {
      ripple,
      ...(pitchCorrection !== undefined && { pitchCorrection }),
      ...(reversed !== undefined && { reversed }),
      ...(rate !== undefined && { rate: () => rate }),
      ...(duration !== undefined && { rate: (clip: Clip) => rateFor(clip, duration) }),
    });
  },
});

/** Puts clips back to normal speed. */
export const resetSpeed = defineCommand({
  id: "speed.reset",
  label: "Reset speed",
  description:
    "Puts clips and their linked clips back to normal speed, forwards and with pitch correction on, so they play their part of the file at its own length. ripple works as in speed.set. Returns { clips: [{ id, rate, duration }] }.",
  undoable: true,
  input: z.object({ clipIds, ripple }),
  run(ctx, { clipIds, ripple }) {
    return change(ctx, clipIds, {
      ripple,
      rate: () => DEFAULT_SPEED.rate,
      pitchCorrection: DEFAULT_SPEED.pitchCorrection,
      reversed: DEFAULT_SPEED.reversed,
    });
  },
});

/** Stops a picture on one frame for a while, moving what follows later. */
export const freezeFrame = defineCommand({
  id: "speed.freezeFrame",
  label: "Freeze frame",
  description:
    "Splits a clip on a video track at `at` (default your playhead) and puts in a 3 second hold of that frame, moving what follows on the track later, with linked clips, so a linked sound gets a gap of that length. The hold trims to any length and has no sound. Fails with speed.unsupported, and with what timeline.splitAt refuses. Returns { hold: id }.",
  undoable: true,
  input: z.object({ clipId: z.string(), at: z.number().int().min(0).optional() }),
  async run(ctx, { clipId, at }) {
    const { store } = ctx.require(projectRef);
    const before = store.getState();
    const clip = before.clips[clipId];
    if (!clip) throw new CommandFailure("speed.clip_not_found", `No clip with id "${clipId}"`);
    if (!canChangeSpeed(before, clip) || before.tracks[clip.trackId]?.kind !== "video") {
      throw new CommandFailure("speed.unsupported", "Only a video's picture can be frozen.", {
        clipId,
      });
    }
    const time = at ?? ctx.require(previewRef).clockFor(ctx.actor).getTime();
    const { created } = await ctx.execute(splitAt, { at: time, clipIds: [clipId] });
    const split = store.getState();
    const right = created.find((id) => split.clips[id]?.trackId === clip.trackId)!;
    const hold: Clip = {
      id: createId("clip"),
      kind: clip.kind,
      trackId: clip.trackId,
      start: time,
      sourceIn: sourceTimeAt(clip, time),
      duration: FREEZE_LENGTH,
      props: structuredClone(clip.props),
      speed: { ...DEFAULT_SPEED, rate: 0 },
      ...(clip.mediaId !== undefined && { mediaId: clip.mediaId }),
      ...(clip.transform && { transform: { ...clip.transform } }),
    };
    const moved = applyMoves(split, rippleMoves(split, right, FREEZE_LENGTH));
    const next = produce(moved, (draft) => {
      draft.clips[hold.id] = hold;
      const track = draft.tracks[hold.trackId]!;
      track.clipIds = sortClipIds([...track.clipIds, hold.id], draft.clips);
    });
    checkLayout(next, new Set([hold.id, right]));
    commitState(ctx, split, next);
    return { hold: hold.id };
  },
});

/** Commands of the speed module. */
export const speedCommands = [setSpeed, resetSpeed, freezeFrame];
