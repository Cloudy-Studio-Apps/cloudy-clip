import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { previewRef } from "@/modules/preview";
import { animatedClip, gradeOf, projectRef } from "@/modules/project";
import { shrinkDataUrl } from "@/ui";
import { clipUnder } from "./logic/strip";

const STILL_WIDTH = 320;

/**
 * Saves the grade of the clip under a time, with a small picture of it, as a still in the project:
 * a look to apply again (`tint.applyLook`). One undo step.
 */
export const grabStill = defineCommand({
  id: "tint.grabStill",
  label: "Grab still",
  description:
    "Saves the grade of the gradeable clip at `at` microseconds (default: your playhead, in your open composition), with a small picture of that frame as it looks graded, as a still of the project. Returns { stillId }. Apply it to clips later with tint_apply_look stillId; remove it with tint_remove_still. A clip with no grade makes a still that changes nothing when applied. Fails with tint.no_composition (none open), tint.no_clip (no gradeable clip there) or preview.capture_failed.",
  undoable: true,
  input: z.object({
    at: z.number().int().min(0).optional().describe("Microseconds"),
    name: z.string().min(1).optional(),
  }),
  async run(ctx, { at, name }) {
    const project = ctx.require(projectRef);
    const preview = ctx.require(previewRef);
    const open = project.view.openFor(ctx.actor);
    if (open === null) {
      throw new CommandFailure("tint.no_composition", "No composition is open.");
    }
    const time = at ?? preview.clockFor(ctx.actor).getTime();
    const clipId = clipUnder(project.store.getState(), open, time);
    if (clipId === null) {
      throw new CommandFailure("tint.no_clip", "There is no gradeable clip at that time.");
    }
    let image: string;
    try {
      image = await shrinkDataUrl(
        await preview.captureAt(time, open, { only: clipId }),
        STILL_WIDTH,
        0.8,
      );
    } catch (error) {
      throw new CommandFailure("preview.capture_failed", String((error as Error).message ?? error));
    }
    const state = project.store.getState();
    const clip = state.clips[clipId];
    if (!clip) throw new CommandFailure("tint.no_clip", "The clip is gone.");
    const grade = gradeOf(animatedClip(clip, time)) ?? undefined;
    const stillId = createId("still");
    const label = name ?? `Still ${(state.stillOrder?.length ?? 0) + 1}`;
    ctx.mutate(project.store, (draft) => {
      (draft.stills ??= {})[stillId] = {
        id: stillId,
        name: label,
        image,
        ...(grade ? { grade: structuredClone(grade) } : {}),
        from: { clipId, time },
      };
      (draft.stillOrder ??= []).push(stillId);
    });
    return { stillId };
  },
});

/** Deletes a still. Clips it was applied to keep what they got. */
export const removeStill = defineCommand({
  id: "tint.removeStill",
  label: "Remove still",
  description:
    "Deletes a still (from tint_describe's stills). Clips it was applied to keep their grades. One undo step. Fails with tint.still_not_found.",
  undoable: true,
  input: z.object({ stillId: z.string().min(1) }),
  run(ctx, { stillId }) {
    const { store } = ctx.require(projectRef);
    if (!store.getState().stills?.[stillId]) {
      throw new CommandFailure("tint.still_not_found", `No still "${stillId}"`);
    }
    ctx.mutate(store, (draft) => {
      delete draft.stills?.[stillId];
      if (Object.keys(draft.stills ?? {}).length === 0) delete draft.stills;
      const order = draft.stillOrder?.filter((id) => id !== stillId) ?? [];
      if (order.length > 0) draft.stillOrder = order;
      else delete draft.stillOrder;
    });
  },
});
