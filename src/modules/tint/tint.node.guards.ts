import { z } from "zod";
import { CommandFailure } from "@/core";
import {
  BUILTIN_LUT_PREFIX,
  correctionValuesSchema,
  type ClipGrade,
  type GradeNode,
  type ProjectState,
} from "@/modules/project";
import { animatedFields } from "./tint.guards";
import type { GradeTarget } from "./tint.types";

/** Which grade: give exactly one of clipId, groupId (a shot group) or compositionId (the whole timeline). */
export const targetSchema = z
  .union([
    z.object({ clipId: z.string().min(1) }).strict(),
    z.object({ groupId: z.string().min(1) }).strict(),
    z.object({ compositionId: z.string().min(1) }).strict(),
  ])
  .describe(
    "Which grade to edit: { clipId } (a clip's own), { groupId } (a shot group's) or { compositionId } (the whole timeline's). Fails with tint.target_not_found, or tint.not_gradeable for a clip with no picture to grade (text, sound, a clip not on a video track).",
  );
export const positionSchema = z
  .object({
    before: z.string().optional(),
    after: z.string().optional(),
    branch: z.object({ group: z.string(), index: z.number().int().min(0) }).optional(),
  })
  .describe(
    "A place in the stack, top (closest to the source) to bottom: { before: nodeId }, { after: nodeId }, { branch: { group: joinId, index } } for the bottom of a group's branch, or {} for the bottom of the stack.",
  );
export const nodeId = z.string().min(1).describe("A node id, from tint_get_grade.");
export const valuesSchema = correctionValuesSchema.describe(
  "Correction values to set, a partial of the fields tint_describe lists, each in its range (units there). A wheel or a group (lift, creative, …) is written whole.",
);
export const lutSchema = z
  .object({ id: z.string().min(1), strength: z.number().min(0).max(1) })
  .describe(
    "A LUT for the correction: id from tint_import_lut (or tint_describe's luts) and strength 0 to 1 (0 changes nothing, 1 is the LUT in full). It runs after Creative.",
  );
/** Refuses a LUT the project hasn't imported (a built-in look's id is taken as it is). */
export function checkLut(state: ProjectState, lut: { id: string } | null | undefined): void {
  if (lut && !lut.id.startsWith(BUILTIN_LUT_PREFIX) && !state.luts?.[lut.id]) {
    throw new CommandFailure("tint.lut_not_found", `No LUT with id "${lut.id}" in this project`);
  }
}
/** `checkLut` for a node of a grade being written: only a correction holds a LUT. */
export function checkNodeLut(state: ProjectState, node: GradeNode | undefined): void {
  if (node?.kind === "correct") checkLut(state, node.lut);
}
export function existing(grade: ClipGrade | null, id: string) {
  const node = grade && Object.hasOwn(grade.nodes, id) ? grade.nodes[id] : undefined;
  if (!grade || !node) {
    throw new CommandFailure("tint.node_not_found", `No node "${id}" in this grade`, {
      nodeId: id,
    });
  }
  return node;
}
/** Refuses unless `id` is a correction of `grade` and none of `fields` has keys (a static write would fight them). */
export function refuseUnlessEditable(
  state: ProjectState,
  target: GradeTarget,
  grade: ClipGrade | null,
  id: string,
  fields: readonly string[],
  same?: (sub: string) => boolean,
): void {
  if (existing(grade, id).kind !== "correct") {
    throw new CommandFailure("tint.node_not_found", `Node "${id}" is not a correction`, {
      nodeId: id,
    });
  }
  const animated = animatedFields(state, target, id, fields, same);
  if (animated.length > 0) {
    throw new CommandFailure(
      "tint.animated",
      `${animated.join(", ")} of node "${id}" has keys. Change it at a time with keyframe_set (path grade.nodes.${id}.values.<field>, or grade.nodes.${id}.opacity; keyframe_list_fields lists them), or pass "at" to tint_set_correction; keyframe_clear drops the keys.`,
      { nodeId: id, fields: animated },
    );
  }
}
