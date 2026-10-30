import { z } from "zod";
import { CommandFailure, defineCommand } from "@/core";
import { partnersOf, projectRef } from "@/modules/project";
import { cloneComposition, copyName } from "./logic/clone";

/** Gives one placement its own copy of the composition. The others keep following the original. */
export const makeUnique = defineCommand({
  id: "composition.makeUnique",
  label: "Make unique",
  description:
    "Gives one placement (a composition clip, with its linked clip) its own copy of the composition, so editing it no longer changes the other placements. Compositions placed inside stay shared. Fails with composition.not_placed on any other clip. Returns { compositionId }.",
  undoable: true,
  input: z.object({ clipId: z.string() }),
  run(ctx, { clipId }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const original = state.clips[clipId]?.compositionRef;
    const composition = original === undefined ? undefined : state.compositions[original];
    if (original === undefined || !composition) {
      throw new CommandFailure("composition.not_placed", `Clip "${clipId}" isn't a composition.`);
    }
    const placement = [clipId, ...partnersOf(state, clipId).map((clip) => clip.id)];
    let copy = "";
    ctx.mutate(store, (draft) => {
      copy = cloneComposition(draft, original, copyName(state, composition.name));
      for (const id of placement) draft.clips[id]!.compositionRef = copy;
    });
    return { compositionId: copy };
  },
});
