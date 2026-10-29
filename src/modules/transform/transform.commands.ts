import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { projectRef } from "@/modules/project";

/**
 * Puts clips' pictures back to fitted and centered. Moving, scaling and rotating go through
 * `element.setProps` with a `transform` patch (the shared group this module owns).
 */
export const resetTransform = defineCommand({
  id: "transform.reset",
  label: "Reset transform",
  description:
    "Puts the pictures of one or more clips back to fitted and centered in the frame (no offset, scale 1, no rotation). To move, scale or rotate a picture use element_set_props with { transform: { x, y, scale, rotation } }. Returns the clips.",
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
      for (const id of clipIds) delete draft.clips[id]!.transform;
    });
    const after = store.getState();
    return clipIds.map((id) => after.clips[id]);
  },
});

/** Commands of the transform module. */
export const transformCommands = [resetTransform];
