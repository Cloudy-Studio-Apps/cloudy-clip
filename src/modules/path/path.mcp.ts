import { z } from "zod";
import { commandTool, defineMcpTool, errorResult, textResult } from "@/core";
import { projectRef } from "@/modules/project";
import { createPath, removePaths, updatePath } from "./path.commands";
import { attachPath, detachPath } from "./path.follow.commands";

/** Reads the motion paths of a composition with the clips that follow each. */
const listPaths = defineMcpTool({
  name: "path_list",
  readOnly: true,
  description:
    "Returns the motion paths of a composition (yours open when compositionId is left out) as [{ id, name, closed, points, followers }]. Points are in output pixels from the frame's center with their handles (inX/inY, outX/outY) as offsets; followers are the ids of the clips following the path.",
  input: z.object({ compositionId: z.string().optional() }),
  handler(input, ctx) {
    const { store, view } = ctx.require(projectRef);
    const state = store.getState();
    const id = input.compositionId ?? view.openFor(ctx.caller.key);
    if (!id || !state.compositions[id]) {
      return errorResult({
        code: "path.composition_not_found",
        message: id ? `No composition "${id}".` : "No composition is open.",
      });
    }
    const clips = Object.values(state.clips);
    return textResult(
      Object.values(state.paths ?? {})
        .filter((path) => path.compositionId === id)
        .map(({ id: pathId, name, closed, points }) => ({
          id: pathId,
          name,
          closed,
          points,
          followers: clips.filter((c) => c.follow?.pathId === pathId).map((c) => c.id),
        })),
    );
  },
});

/** Agents draw, edit and follow paths with the same commands as the user. */
export const pathMcpTools = [
  listPaths,
  commandTool(createPath, { name: "path_create" }),
  commandTool(updatePath, { name: "path_update" }),
  commandTool(removePaths, { name: "path_remove" }),
  commandTool(attachPath, { name: "path_attach" }),
  commandTool(detachPath, { name: "path_detach" }),
];
