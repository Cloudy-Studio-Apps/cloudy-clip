import { z } from "zod";
import { CommandFailure, createId, defineCommand, type CommandContext } from "@/core";
import {
  correctionOf,
  gradeLimitSchema,
  projectRef,
  type ClipGrade,
  type Correction,
} from "@/modules/project";
import { leafAt } from "./logic/keyable";
import { emptyGrade } from "./logic/stack";
import {
  insertLayer,
  moveLayer as moveInGrade,
  removeNodes as removeFromGrade,
} from "./logic/stack.edit";
import { checkSharedKey, checkedGrade, dropTracks, readGrade, writeGrade } from "./tint.guards";
import {
  checkLut,
  existing,
  lutSchema,
  nodeId,
  positionSchema,
  refuseUnlessEditable,
  targetSchema,
  valuesSchema,
} from "./tint.node.guards";
import { keyPatch } from "./tint.key.patch";
import type { GradeTarget, StackPosition } from "./tint.types";

function placeFailure(grade: ClipGrade, at: StackPosition): CommandFailure {
  const missing = [at.before, at.after, at.branch?.group].find(
    (id) => id !== undefined && !grade.nodes[id],
  );
  if (missing !== undefined) {
    return new CommandFailure("tint.node_not_found", `No node "${missing}" in this grade`, {
      nodeId: missing,
    });
  }
  return new CommandFailure(
    "tint.sealed",
    "That place is inside a part of the grade Baby Seal can't show (a sealed card), or it splits a picture into channels.",
  );
}

/** The fields of a patch that have keys in their way. */
const liveFields = (patch: { opacity?: number; on?: boolean }) => [
  ...(patch.opacity !== undefined ? ["opacity"] : []),
  ...(patch.on !== undefined ? ["on"] : []),
];

/** Sets a correction's opacity and on from a patch. */
function setLive(node: Correction, patch: { opacity?: number; on?: boolean }): void {
  if (patch.opacity !== undefined) node.opacity = patch.opacity;
  if (patch.on !== undefined) node.on = patch.on;
}

/** Checks and writes `next` over `before`, writing nothing when it comes out the same. */
function writeChanged(
  ctx: CommandContext,
  target: GradeTarget,
  before: ClipGrade | null,
  next: ClipGrade,
): void {
  const stored = checkedGrade(next);
  if (JSON.stringify(stored) === JSON.stringify(before)) return;
  const { store } = ctx.require(projectRef);
  ctx.mutate(store, (draft) => writeGrade(draft, target, stored));
}

/** Adds a correction layer to a grade. */
export const addCorrection = defineCommand({
  id: "tint.addCorrection",
  label: "Add correction",
  description:
    "Adds a correction (one grade step) to a clip's, shot group's or composition's grade, at a place in the stack (default: the bottom, last to run) with optional values, limit, lut and name. Returns { nodeId }. Values are stored only where they differ from the defaults. limit.from (a correction id, or a key join's) shares that correction's pick (or the joined key) instead of one of its own. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found (the place, or limit.from, names a missing node), tint.sealed (the place is inside a sealed card), tint.key_not_limited / tint.key_cycle / tint.key_not_above (see tint_set_correction), tint.lut_not_found or tint.invalid_grade (a value out of range; nothing is written).",
  undoable: true,
  input: z.object({
    target: targetSchema,
    at: positionSchema.optional(),
    values: valuesSchema.optional(),
    limit: gradeLimitSchema
      .optional()
      .describe("What the correction touches; whole frame when missing."),
    lut: lutSchema.optional(),
    name: z.string().optional(),
  }),
  run(ctx, { target, at, values, limit, lut, name }) {
    const { store } = ctx.require(projectRef);
    checkLut(store.getState(), lut);
    const grade = readGrade(store.getState(), target) ?? emptyGrade();
    const place = at ?? {};
    const id = createId("node");
    const node: Correction = {
      kind: "correct",
      input: { node: "source" },
      on: true,
      opacity: 1,
      ...(name !== undefined ? { name } : {}),
      ...(values ? { values } : {}),
      ...(limit ? { limit } : {}),
      ...(lut ? { lut } : {}),
    };
    let next: ClipGrade;
    try {
      next = insertLayer(grade, place, id, node);
    } catch {
      throw placeFailure(grade, place);
    }
    checkSharedKey(next, id);
    const stored = checkedGrade(next);
    ctx.mutate(store, (draft) => writeGrade(draft, target, stored));
    return { nodeId: id };
  },
});

/** Changes a correction. */
export const setCorrection = defineCommand({
  id: "tint.setCorrection",
  label: "Change correction",
  description:
    "Changes one correction: patch.values (a partial of the correction's fields, merged over what it has: each given field replaces that field whole), patch.limit (what it touches; null removes the limit; { from: nodeId } shares the pick of another correction, one above it whose limit limits something, instead of its own: its key, its refine and clean up, and inverted again when this limit has invert: true; or names a key join from tint_wire, whose combined key it mixes by), patch.lut ({ id, strength 0 to 1 }: a LUT from tint_import_lut, after Creative; null removes it), patch.opacity (0 to 1), patch.on and patch.name. Fields at their defaults are not stored. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found (or the node is not a correction, or limit.from names no node), tint.key_not_limited (limit.from is neither a key join nor a correction with a limit), tint.key_cycle (limit.from is this correction or reads it: below it in the stack), tint.key_not_above (limit.from is not above it: another branch); these three are checked only when patch.limit changes limit.from, so other limit edits of a correction whose owner stopped limiting still succeed (it is then unlimited), tint.lut_not_found (patch.lut names a LUT the project hasn't imported), tint.invalid_grade (a value out of range; nothing is written) or tint.animated (a number that has keys needs a key at a time, not a static value: a patch may hold a keyed number only at its stored value, e.g. a wheel written whole around a keyed component). With at (a timeline time, clip grades only), each keyed number the patch changes from its value at that time gets a key there instead (keyframe_set), in the same undo step; the rest is written as usual.",
  undoable: true,
  input: z.object({
    target: targetSchema,
    at: z
      .number()
      .int()
      .optional()
      .describe("Timeline time in microseconds: keyed numbers in the patch get a key here."),
    nodeId,
    patch: z.object({
      values: valuesSchema.optional(),
      limit: gradeLimitSchema.nullable().optional(),
      lut: lutSchema.nullable().optional(),
      opacity: z.number().min(0).max(1).optional(),
      on: z.boolean().optional(),
      name: z.string().optional(),
    }),
  }),
  async run(ctx, { target, at, nodeId: id, patch: asked }) {
    const { store } = ctx.require(projectRef);
    checkLut(store.getState(), asked.lut);
    const patch =
      at !== undefined && "clipId" in target
        ? await keyPatch(ctx, target.clipId, id, asked, at)
        : asked;
    const state = store.getState();
    const grade = readGrade(state, target);
    const fields = [...Object.keys(patch.values ?? {}), ...liveFields(patch)];
    const before = grade && Object.hasOwn(grade.nodes, id) ? grade.nodes[id] : undefined;
    const stored = before?.kind === "correct" ? correctionOf(before) : undefined;
    const same = (sub: string) =>
      sub === "opacity"
        ? before?.kind === "correct" && patch.opacity === before.opacity
        : stored !== undefined && leafAt(patch.values, sub) === leafAt(stored, sub);
    refuseUnlessEditable(state, target, grade, id, fields, same);
    const next = structuredClone(grade!);
    const node = next.nodes[id] as Correction;
    if (patch.values) node.values = { ...node.values, ...structuredClone(patch.values) };
    if (patch.limit === null) delete node.limit;
    else if (patch.limit) node.limit = patch.limit;
    if (patch.lut === null) delete node.lut;
    else if (patch.lut) node.lut = patch.lut;
    setLive(node, patch);
    if (patch.name !== undefined) node.name = patch.name;
    // Only a pick being chosen is checked: other edits keep a stored key as validateGrade allows it.
    const was = before?.kind === "correct" ? before.limit?.from : undefined;
    if (patch.limit && patch.limit.from !== was) checkSharedKey(next, id);
    writeChanged(ctx, target, grade, next);
  },
});

/** Turns several corrections on or off, or fades them, in one step (a sealed card's eye and fade). */
export const setCorrections = defineCommand({
  id: "tint.setCorrections",
  label: "Change corrections",
  description:
    "Sets on and/or opacity of several corrections of one grade in a single undo step, all or nothing: if any node fails, nothing is written. Fields at their defaults are not stored. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found (a node is missing or not a correction), tint.animated (a field of one of them has keys) or tint.invalid_grade (nothing is written).",
  undoable: true,
  input: z.object({
    target: targetSchema,
    nodeIds: z.array(nodeId).min(1),
    patch: z.object({ opacity: z.number().min(0).max(1).optional(), on: z.boolean().optional() }),
  }),
  run(ctx, { target, nodeIds, patch }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const grade = readGrade(state, target);
    const fields = liveFields(patch);
    const next = structuredClone(grade!);
    for (const id of nodeIds) {
      refuseUnlessEditable(state, target, grade, id, fields);
      setLive(next.nodes[id] as Correction, patch);
    }
    writeChanged(ctx, target, grade, next);
  },
});

/** Removes nodes from a grade. */
export const removeNodes = defineCommand({
  id: "tint.removeNodes",
  label: "Remove corrections",
  description:
    "Removes nodes from a grade by id. What read a removed node reads its input instead, shared keys from it are dropped, and its key tracks go with it. Removing them all leaves the target ungraded. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found or tint.invalid_grade.",
  undoable: true,
  input: z.object({ target: targetSchema, nodeIds: z.array(nodeId).min(1) }),
  run(ctx, { target, nodeIds }) {
    const { store } = ctx.require(projectRef);
    const grade = readGrade(store.getState(), target);
    for (const id of nodeIds) existing(grade, id);
    const stored = checkedGrade(removeFromGrade(grade!, nodeIds));
    const gone = nodeIds.map((id) => `grade.nodes.${id}.`);
    ctx.mutate(store, (draft) => {
      writeGrade(draft, target, stored);
      dropTracks(
        draft,
        target,
        (path) => !stored || gone.some((prefix) => path.startsWith(prefix)),
      );
    });
  },
});

/** Moves a layer in the stack. */
export const moveLayer = defineCommand({
  id: "tint.moveLayer",
  label: "Move correction",
  description:
    "Moves a layer (or a group, or a sealed card, by its first node id) to another place in the stack: { before }, { after } or { branch }. Fails with tint.target_not_found, tint.not_gradeable, tint.node_not_found, or tint.sealed when the move can't be done in the stack (into or out of a sealed card, a group into itself, or a result that isn't a valid grade, such as a shared pick no longer from above).",
  undoable: true,
  input: z.object({ target: targetSchema, nodeId, to: positionSchema }),
  run(ctx, { target, nodeId: id, to }) {
    const { store } = ctx.require(projectRef);
    const grade = readGrade(store.getState(), target);
    existing(grade, id);
    const missing = [to.before, to.after, to.branch?.group].find(
      (one) => one !== undefined && !grade!.nodes[one],
    );
    if (missing !== undefined) {
      throw new CommandFailure("tint.node_not_found", `No node "${missing}" in this grade`, {
        nodeId: missing,
      });
    }
    const moved = moveInGrade(grade!, id, to);
    if (!moved) {
      throw new CommandFailure(
        "tint.sealed",
        `Node "${id}" can't move there: the stack can't show that place or result.`,
      );
    }
    const stored = checkedGrade(moved);
    ctx.mutate(store, (draft) => writeGrade(draft, target, stored));
  },
});
