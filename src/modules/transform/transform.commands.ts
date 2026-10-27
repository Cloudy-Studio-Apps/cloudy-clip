import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { clipTransform, normalizeRotation, projectRef } from "@/modules/project";

const pixels = z.number().finite().min(-100_000).max(100_000);

/**
 * Moves, scales or rotates a video clip's picture in the frame. Only the given fields change.
 */
export const setClipTransform = defineCommand({
  id: "transform.setClipTransform",
  label: "Transform clip",
  description:
    "Moves, scales or rotates a video clip's picture in the output frame; fields left out keep their value. The picture starts fitted and centered in the frame. x/y: offset of the picture's center from the frame's center, in output pixels (y down). scale: 1 = fits the frame, 2 = twice as big. rotation: clockwise degrees. Pass reset: true to go back to fitted and centered. Returns the clip.",
  undoable: true,
  input: z.object({
    clipId: z.string(),
    x: pixels.optional(),
    y: pixels.optional(),
    scale: z.number().min(0.01).max(20).optional(),
    rotation: z.number().finite().optional(),
    reset: z.boolean().optional(),
  }),
  run(ctx, { clipId, reset, ...changes }) {
    const store = ctx.require(projectRef).store;
    const state = store.getState();
    const clip = state.clips[clipId];
    if (!clip) throw new CommandFailure("transform.clip_not_found", `No clip with id "${clipId}"`);
    if (state.tracks[clip.trackId]?.kind !== "video") {
      throw new CommandFailure("transform.not_visual", "Audio clips have no picture to transform");
    }

    ctx.mutate(store, (draft) => {
      const target = draft.clips[clipId]!;
      if (reset) {
        delete target.transform;
        return;
      }
      const next = { ...clipTransform(clip), ...changes };
      target.transform = { ...next, rotation: normalizeRotation(next.rotation) };
    });
    return store.getState().clips[clipId];
  },
});

/** Commands that place a clip's picture in the frame. */
export const transformCommands = [setClipTransform];
