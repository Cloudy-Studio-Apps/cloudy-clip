import { produce } from "immer";
import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { mediaRef } from "@/modules/media";
import { partnersOf, projectRef, compositionOf } from "@/modules/project";
import { clampTrim } from "./logic/placement";
import { linkedTrimEdge, trimLimits } from "./logic/trim";
import {
  checkLayout,
  requireClip,
  requireSameComposition,
  requireTrack,
  time,
} from "./timeline.guards";
import {
  commitState,
  followMove,
  junctionKindOf,
  moveClips,
  rippleTrim,
} from "./timeline.junctions";
import { editSoundOnly } from "./timeline.sound";

/**
 * Moves a clip in time and, optionally, to another track of the same kind. Linked clips move by
 * the same offset and stay on their own tracks. Junctions of the moved clips follow (kept, new
 * duration, or removed); the result lists the removed ones.
 */
export const moveClip = defineCommand({
  id: "timeline.moveClip",
  label: "Move clip",
  description:
    "Moves a clip to a new start time and optionally to another track of the same kind. Linked clips (a video's picture and sound) move by the same offset on their own tracks. A junction (transition) on the clip's cuts is kept when its clips still overlap by its duration, takes the new overlap as its duration when they overlap by another amount (fails with junction.invalid_duration outside the kind's limits), and is removed when they only touch or come apart (no shift back). Fails, changing nothing, if any clip would overlap another. Returns the clip plus removedJunctions (ids). With soundOnly, the clip must be on an audio track (else timeline.not_sound); if linked it is unlinked first and moves alone, leaving its picture where it is (one undo step); without it, linked clips move together.",
  undoable: true,
  input: z.object({
    clipId: z.string(),
    start: time,
    trackId: z.string().optional(),
    soundOnly: z.boolean().optional(),
  }),
  run: (ctx, { clipId, start, trackId, soundOnly }) =>
    editSoundOnly(ctx, [clipId], soundOnly, () => {
      const state = ctx.require(projectRef).store.getState();
      const clip = requireClip(state, clipId);
      const targetId = trackId ?? clip.trackId;
      const target = requireTrack(state, targetId);
      const source = requireTrack(state, clip.trackId);
      if (target.kind !== source.kind) {
        throw new CommandFailure(
          "timeline.kind_mismatch",
          `A ${source.kind} clip cannot move to the ${target.kind} track "${target.name}".`,
        );
      }
      requireSameComposition(target, compositionOf(state, source));
      const delta = start - clip.start;
      const moves = [clip, ...partnersOf(state, clipId)].map((c) => ({
        clipId: c.id,
        start: c.start + delta,
        trackId: c.id === clipId ? targetId : c.trackId,
      }));
      if (moves.some((move) => move.start < 0)) {
        throw new CommandFailure(
          "timeline.out_of_range",
          "A linked clip would start before the beginning of the timeline",
        );
      }
      const movedIds = moves.map((move) => move.clipId);
      const { state: next, removed } = followMove(
        moveClips(state, moves),
        movedIds,
        junctionKindOf(ctx),
      );
      checkLayout(next, new Set(movedIds));
      commitState(ctx, state, next);
      return { ...next.clips[clipId]!, removedJunctions: removed };
    }),
});

/**
 * Moves one edge of a clip. The result is clamped: a clip never grows past its source media,
 * never overlaps its neighbours, and never gets shorter than one frame. Linked clips get the
 * same edge (the tightest of their limits). A joined edge (shorter or longer) ripples the clips
 * after it so the junction's overlap stays; a junction too long for the new lengths shrinks to its maximum.
 */
export const trimClip = defineCommand({
  id: "timeline.trimClip",
  label: "Trim clip",
  description:
    'Moves the "start" or "end" edge of a clip to a timeline time. Clamped to the source media length, the neighbouring clips (except one joined by a junction on that edge), and a one-frame minimum. Linked clips (a video\'s picture and sound) are trimmed to the same edge, the tightest of their limits. Trimming an edge joined by a junction (transition: the end of the left clip or the start of the right one), shorter or longer, keeps the start of the right clip where the overlap needs it and moves its end and everything after it on that track (with linked partners) by the change, so the overlap stays (fails with timeline.overlap if something unlinked is in the way); if a clip gets too short for the junction, its duration shrinks to the new maximum (later clips shift by the difference). Returns the resulting clip. With soundOnly, the clip must be on an audio track (else timeline.not_sound); if linked it is unlinked first and trimmed alone, leaving its picture as it is (one undo step).',
  undoable: true,
  input: z.object({
    clipId: z.string(),
    edge: z.enum(["start", "end"]),
    time,
    soundOnly: z.boolean().optional(),
  }),
  run: (ctx, { clipId, edge, time: to, soundOnly }) =>
    editSoundOnly(ctx, [clipId], soundOnly, () => {
      const state = ctx.require(projectRef).store.getState();
      const clip = requireClip(state, clipId);
      const media = ctx.require(mediaRef);
      const durationOf = (id: string) =>
        media.pictureMeta(id)?.duration ?? media.getProbe(id)?.duration;
      const group = [clip, ...partnersOf(state, clipId)];
      const edgeTime = linkedTrimEdge(state, group, edge, to, durationOf);
      const trimmed = produce(state, (draft) => {
        for (const c of group) {
          Object.assign(
            draft.clips[c.id]!,
            clampTrim(c, edge, edgeTime, trimLimits(state, c, durationOf, edge)),
          );
        }
      });
      const groupIds = group.map((c) => c.id);
      const next = rippleTrim(state, trimmed, groupIds, edge, junctionKindOf(ctx));
      checkLayout(next, new Set(groupIds));
      commitState(ctx, state, next);
      return next.clips[clipId];
    }),
});
