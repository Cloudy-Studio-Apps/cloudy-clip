import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { setKey } from "@/modules/keyframe";
import { previewRef } from "@/modules/preview";
import {
  bakeFollow,
  clipEnd,
  clipTransform,
  compositionOf,
  frameDuration,
  NO_FOLLOW,
  projectRef,
  type Clip,
  type ProjectState,
} from "@/modules/project";

const PROGRESS = "follow.progress";

function requireClip(state: ProjectState, clipId: string): Clip {
  const clip = state.clips[clipId];
  if (!clip) throw new CommandFailure("path.clip_not_found", `No clip "${clipId}".`);
  return clip;
}

/** Makes clips follow a path, with Progress keyed from its start to its end. */
export const attachPath = defineCommand({
  id: "path.attach",
  label: "Follow path",
  description:
    "Makes picture clips follow a path of their own composition, in one step. Their position (transform.x/y) becomes an offset from the path and is set to 0 (X/Y keys are kept, as offsets). A clip without Progress keys gets two: 0 at its first frame and 1 (100 %) at its last, so it travels the whole path over its length; move or ease them with the keyframe tools (path follow.progress). A clip already on another path switches to this one and keeps its keys. Fails with path.clip_not_found, path.not_picture (not on a video track), path.not_found and path.other_composition. Returns { clipIds }.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), pathId: z.string() }),
  async run(ctx, { clipIds, pathId }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const path = state.paths?.[pathId];
    const clips = clipIds.map((id) => requireClip(state, id));
    for (const clip of clips) {
      const track = state.tracks[clip.trackId]!;
      if (track.kind !== "video") {
        throw new CommandFailure("path.not_picture", `Clip "${clip.id}" has no picture to move.`);
      }
      if (!path) throw new CommandFailure("path.not_found", `No path "${pathId}".`);
      if (track.compositionId !== path.compositionId) {
        throw new CommandFailure(
          "path.other_composition",
          `Clip "${clip.id}" is in another composition than path "${pathId}".`,
        );
      }
    }
    ctx.mutate(store, (draft) => {
      for (const clip of clips) {
        const target = draft.clips[clip.id]!;
        target.follow = { ...NO_FOLLOW, ...clip.follow, pathId };
        target.transform = { ...clipTransform(clip), x: 0, y: 0 };
      }
    });
    for (const clip of clips) {
      if (clip.animation?.[PROGRESS]) continue;
      const frame = frameDuration(compositionOf(state, state.tracks[clip.trackId]!).format);
      const last = Math.max(clip.start, clipEnd(clip) - frame);
      await ctx.execute(setKey, { clipId: clip.id, path: PROGRESS, at: clip.start, value: 0 });
      await ctx.execute(setKey, { clipId: clip.id, path: PROGRESS, at: last, value: 1 });
    }
    return { clipIds };
  },
});

/** Makes clips stop following their path, staying where they are at `at`. */
export const detachPath = defineCommand({
  id: "path.detach",
  label: "Stop following path",
  description:
    'Makes clips stop following their path, in one step: each stays where it was at "at" (timeline microseconds, default your playhead, brought into the clip). The path\'s position (and direction, with orient) there is added to its position and rotation and to every key of them, and its Progress keys go. Clips that follow no path are skipped. Fails with path.clip_not_found.',
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), at: z.number().int().min(0).optional() }),
  run(ctx, { clipIds, at }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const clips = clipIds.map((id) => requireClip(state, id)).filter((clip) => clip.follow);
    if (clips.length === 0) return;
    const when = at ?? ctx.require(previewRef).clockFor(ctx.actor).getTime();
    ctx.mutate(store, (draft) => {
      for (const clip of clips) draft.clips[clip.id] = bakeFollow(clip, state.paths, when);
    });
  },
});
