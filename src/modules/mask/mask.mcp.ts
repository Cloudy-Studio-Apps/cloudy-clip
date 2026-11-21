import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { previewRef } from "@/modules/preview";
import { animatedClip, orderedMasks, projectRef } from "@/modules/project";
import { addMask, removeMasks, reorderMask, updateMask } from "./mask.commands";
import { setMatte } from "./mask.matte.commands";
import { convertMask, setPoints } from "./mask.points.commands";

/** Reads a clip's masks in order, with the values they have at a time, and its matte. */
const listMasks = defineMcpTool({
  name: "mask_list",
  readOnly: true,
  description:
    "Returns { masks, matte } of a clip: its masks in the order they apply, each with id, name, color, on, invert, mode and its values at \"at\" (timeline microseconds, default your playhead; keyed values are sampled): opacity, feather, expansion, x, y, rotation and its shape (path points as { id, x, y, inX, inY, outX, outY } relative to the mask's x/y). Mask space is output px from the picture's center, the picture fitted in the frame before the clip's transform. Fails with mask.clip_not_found.",
  input: z.object({ clipId: z.string(), at: z.number().int().min(0).optional() }),
  handler({ clipId, at }, ctx) {
    const { clips } = ctx.require(projectRef).store.getState();
    const clip = Object.hasOwn(clips, clipId) ? clips[clipId] : undefined;
    if (!clip) return errorResult({ code: "mask.clip_not_found", message: `No clip "${clipId}".` });
    const time = at ?? ctx.require(previewRef).clockFor(ctx.caller.key).getTime();
    const masks = orderedMasks(animatedClip(clip, time)).map(({ on, invert, shape, ...mask }) => ({
      ...mask,
      on: on !== false,
      invert: invert === true,
      shape:
        shape.kind === "path"
          ? {
              kind: "path",
              scale: shape.scale,
              points: shape.pointOrder.map((id) => ({ id, ...shape.points[id]! })),
            }
          : shape,
    }));
    return textResult({ masks, matte: clip.matte ?? null });
  },
});

/** Agents mask and matte with the same commands as the user. */
export const maskMcpTools = [
  listMasks,
  commandTool(addMask, { name: "mask_add" }),
  commandTool(updateMask, { name: "mask_update" }),
  commandTool(removeMasks, { name: "mask_remove" }),
  commandTool(reorderMask, { name: "mask_reorder" }),
  commandTool(setMatte, { name: "mask_set_matte" }),
  commandTool(setPoints, { name: "mask_set_points" }),
  commandTool(convertMask, { name: "mask_convert" }),
];
