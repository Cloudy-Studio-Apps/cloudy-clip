import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { clipTransform, projectRef, withoutTracks } from "@/modules/project";

/**
 * Puts clips' pictures back to fitted and centered. Moving, scaling, stretching, rotating and the
 * pivot go through `element.setProps` with a `transform` patch (the shared group this module owns).
 */
export const resetTransform = defineCommand({
  id: "transform.reset",
  label: "Reset transform",
  description:
    "Puts the pictures of one or more clips back to fitted and centered in the frame (no offset, scale 1, no stretch or flip, no rotation, pivot at the center), and drops the keys of those values. To change a picture use element_set_props with { transform: { x, y, scale, scaleX, scaleY, rotation, pivotX, pivotY } }: x/y place the pivot (output px from the frame's center), scale/scaleX/scaleY/rotation turn and size the picture about it, pivotX/pivotY are fractions of the picture from its center (-0.5 = left/top edge). Returns the clips.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  run(ctx, { clipIds }) {
    const store = ctx.require(projectRef).store;
    const state = store.getState();
    for (const id of clipIds) {
      if (!state.clips[id])
        throw new CommandFailure("transform.clip_not_found", `No clip with id "${id}"`);
    }
    ctx.mutate(store, (draft) => {
      for (const id of clipIds) {
        const clip = draft.clips[id]!;
        delete clip.transform;
        const animation = withoutTracks(clip.animation, (path) => path.startsWith("transform."));
        if (animation) clip.animation = animation;
        else delete clip.animation;
      }
    });
    const after = store.getState();
    return clipIds.map((id) => after.clips[id]);
  },
});

/**
 * Mirrors clips' pictures, the After Effects way: negates `scaleX` (horizontal) or `scaleY`
 * (vertical), and every key of that value, so the whole clip mirrors in one undo step.
 */
export const flipTransform = defineCommand({
  id: "transform.flip",
  label: "Flip",
  description:
    "Mirrors the pictures of one or more clips on video tracks: horizontal negates transform.scaleX, vertical negates transform.scaleY, together with every key of that value, so the clip mirrors over its whole length. Flipping twice gives the picture back. The same as element_set_props with { transform: { scaleX: -current } } on a clip without keys. Returns the clips.",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string()).min(1),
    axis: z.enum(["horizontal", "vertical"]),
  }),
  run(ctx, { clipIds, axis }) {
    const store = ctx.require(projectRef).store;
    const state = store.getState();
    for (const id of clipIds) {
      const clip = state.clips[id];
      if (!clip) throw new CommandFailure("transform.clip_not_found", `No clip with id "${id}"`);
      if (state.tracks[clip.trackId]?.kind !== "video")
        throw new CommandFailure("transform.not_picture", `Clip "${id}" isn't on a video track`);
    }
    const field = axis === "horizontal" ? "scaleX" : "scaleY";
    ctx.mutate(store, (draft) => {
      for (const id of clipIds) {
        const clip = draft.clips[id]!;
        const transform = clipTransform(clip);
        clip.transform = { ...transform, [field]: -transform[field] };
        for (const key of clip.animation?.[`transform.${field}`]?.keys ?? []) {
          key.value = -(key.value as number);
        }
      }
    });
    const after = store.getState();
    return clipIds.map((id) => after.clips[id]);
  },
});

/** Commands of the transform module. */
export const transformCommands = [resetTransform, flipTransform];
