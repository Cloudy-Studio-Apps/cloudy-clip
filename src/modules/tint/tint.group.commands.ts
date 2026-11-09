import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { BLEND_MODES, projectRef, type ClipGrade } from "@/modules/project";
import { groupLayers, groupOf, ungroup as ungroupInGrade } from "./logic/stack.group";
import { animatedFields, checkedGrade, dropTracks, readGrade, writeGrade } from "./tint.guards";
import { targetSchema } from "./tint.node.commands";

const nodeId = z.string().min(1).describe("A node id, from tint_get_grade.");

/** The grade a target holds; throws `tint.node_not_found` without one. */
function gradeWith(grade: ClipGrade | null, id: string): ClipGrade {
  if (!grade?.nodes[id]) {
    throw new CommandFailure("tint.node_not_found", `No node "${id}" in this grade`, {
      nodeId: id,
    });
  }
  return grade;
}

/** Puts layers in a group. */
export const group = defineCommand({
  id: "tint.group",
  label: "Group corrections",
  description:
    'Puts layers that follow one another in one list of the stack (the top level or one branch of a group) into a group, in their place: kind "parallel" (Side by side: each layer becomes its own branch from the picture above, and their changes are added together: in + opacity · Σ (branch − in)), "layer" (Stacked: each layer its own branch, each branch landing over the picture so far by its blend, the first lowest, the last on top; every blend starts as normal, so the last branch shows; change blends with tint_set_group) or "channels" (Per channel: one to three layers go in the red, green and blue branches in that order, each grading one channel of the picture as gray, the others left empty; the group puts red, green and blue back together). Side by side and Stacked need at least two layers. nodeIds are layer ids or a group\'s join id. Returns { joinId }, the group\'s id. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found, or tint.cant_group (the layers are not in one list one after another, too few or too many, or the result can\'t be shown as layers).',
  undoable: true,
  input: z.object({
    target: targetSchema,
    nodeIds: z.array(nodeId).min(1),
    kind: z.enum(["parallel", "layer", "channels"]),
  }),
  run(ctx, { target, nodeIds, kind }) {
    const { store } = ctx.require(projectRef);
    let grade = readGrade(store.getState(), target);
    for (const id of nodeIds) grade = gradeWith(grade, id);
    const joinId = createId("node");
    const next = groupLayers(
      grade!,
      nodeIds,
      kind,
      joinId,
      kind === "channels" ? createId("node") : undefined,
    );
    if (!next) {
      throw new CommandFailure(
        "tint.cant_group",
        "Those layers can't be grouped: they must follow one another in one list of the stack (Side by side and Stacked need two or more, Per channel one to three).",
      );
    }
    const stored = checkedGrade(next);
    ctx.mutate(store, (draft) => writeGrade(draft, target, stored));
    return { joinId };
  },
});

/** Takes a group apart. */
export const ungroup = defineCommand({
  id: "tint.ungroup",
  label: "Ungroup corrections",
  description:
    "Takes a group apart: its branches' layers in a row where the group was, branch by branch (top branch first), the group itself gone. Key tracks of the group go with it. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found, or tint.not_a_group (joinId is not a group the stack shows).",
  undoable: true,
  input: z.object({ target: targetSchema, joinId: nodeId }),
  run(ctx, { target, joinId }) {
    const { store } = ctx.require(projectRef);
    const grade = gradeWith(readGrade(store.getState(), target), joinId);
    const found = groupOf(grade, joinId);
    if (!found) {
      throw new CommandFailure("tint.not_a_group", `Node "${joinId}" is not a group of the stack`, {
        nodeId: joinId,
      });
    }
    const stored = checkedGrade(ungroupInGrade(grade, joinId));
    const gone = [joinId, ...(found.split ? [found.split] : [])].map((id) => `grade.nodes.${id}.`);
    ctx.mutate(store, (draft) => {
      writeGrade(draft, target, stored);
      dropTracks(draft, target, (path) => gone.some((prefix) => path.startsWith(prefix)));
    });
  },
});

/** Changes a side-by-side or stacked group. */
export const setGroup = defineCommand({
  id: "tint.setGroup",
  label: "Change group",
  description:
    "Changes a Side by side or Stacked group (joinId from tint_get_grade): patch.opacity (0 to 1, how much of the group's change shows over the picture coming in), patch.on (off: the picture passes through untouched) and, for Stacked, patch.blends (one blend mode per branch, top branch first: " +
    BLEND_MODES.join(", ") +
    "). A Per channel group has none of these. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found, tint.not_a_group (not a Side by side or Stacked group, or blends on Side by side), tint.invalid_grade (blends not one per branch) or tint.animated (a field that has keys).",
  undoable: true,
  input: z.object({
    target: targetSchema,
    joinId: nodeId,
    patch: z.object({
      opacity: z.number().min(0).max(1).optional(),
      on: z.boolean().optional(),
      blends: z.array(z.enum(BLEND_MODES)).optional(),
    }),
  }),
  run(ctx, { target, joinId, patch }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const grade = gradeWith(readGrade(state, target), joinId);
    const join = grade.nodes[joinId]!;
    if (
      (join.kind !== "parallel" && join.kind !== "layer") ||
      (patch.blends && join.kind !== "layer")
    ) {
      throw new CommandFailure(
        "tint.not_a_group",
        `Node "${joinId}" is not a ${patch.blends ? "Stacked" : "Side by side or Stacked"} group`,
        { nodeId: joinId },
      );
    }
    const fields = (["opacity", "on"] as const).filter((field) => patch[field] !== undefined);
    const animated = animatedFields(state, target, joinId, fields);
    if (animated.length > 0) {
      throw new CommandFailure(
        "tint.animated",
        `${animated.join(", ")} of group "${joinId}" has keys. Change it at a time with a key.`,
        { nodeId: joinId, fields: animated },
      );
    }
    const next = structuredClone(grade);
    const node = next.nodes[joinId] as typeof join;
    if (patch.opacity !== undefined) node.opacity = patch.opacity;
    if (patch.on !== undefined) node.on = patch.on;
    if (patch.blends && node.kind === "layer") node.blends = [...patch.blends];
    const stored = checkedGrade(next);
    if (JSON.stringify(stored) === JSON.stringify(grade)) return;
    ctx.mutate(store, (draft) => writeGrade(draft, target, stored));
  },
});
