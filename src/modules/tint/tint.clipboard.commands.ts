import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { projectRef, type ClipGrade } from "@/modules/project";
import { pastePart } from "./logic/paste";
import { TOOL_IDS } from "./logic/tools";
import {
  checkedGrade,
  dropTracks,
  readGrade,
  targetName,
  targetsOf,
  writeGrade,
} from "./tint.guards";
import { checkNodeLut, refuseUnlessEditable, targetSchema } from "./tint.node.guards";
import { tintRef } from "./tint.ref";
import type { GradeTarget } from "./tint.types";

/** Copies a grade to your own clipboard. Changes nothing in the project. */
export const copyGrade = defineCommand({
  id: "tint.copy",
  label: "Copy grade",
  description:
    "Copies the grade of a clip, shot group or composition to your own clipboard, which only you can paste from (the user and each agent have one). Nothing in the project changes. Returns { copied }, the number of nodes. Fails with tint.target_not_found, tint.not_gradeable or tint.nothing_to_copy (the target has no grade).",
  undoable: false,
  input: z.object({ target: targetSchema }),
  run(ctx, { target }) {
    const grade = readGrade(ctx.require(projectRef).store.getState(), target);
    if (!grade) throw new CommandFailure("tint.nothing_to_copy", "That has no grade to copy.");
    ctx.require(tintRef).clipboard.set(ctx.actor, structuredClone(grade));
    return { copied: Object.keys(grade.nodes).length };
  },
});

/** Pastes the copied grade onto clips, shot groups or compositions: whole, or only some tools. */
export const pasteGrade = defineCommand({
  id: "tint.paste",
  label: "Paste grade",
  description:
    "Pastes your clipboard (tint_copy) onto clips (clipIds) or any grades (targets: { clipId }, { groupId } a shot group's, { compositionId } the whole timeline's); give either or both. With no tools, each grade is replaced by the copy (a clip's key tracks go; a clip keeps its own camera color space, input, and a group or composition takes none). With tools (basics, wheels, curves, cmix, warper, creative, limit, luts, match, mixer), only the fields those tools own are written, into the corrections at the same place in the stack (the first layer takes from the first, and so on; a field the copy lacks is cleared); a clip with fewer layers gets new ones at the bottom, when the copy's layer has something of those tools. Groups and sealed cards are not matched, and a limit's shared pick (limit.from) is not carried over. To paste to all, give every clip of the composition. Every clip is checked first; all change in one undo step, or none, and a clip left as it was is not written. Returns { pasted }, the number of grades changed. Fails with tint.clipboard_empty, tint.no_target, tint.lut_not_found (a LUT the project has not imported), tint.target_not_found, tint.not_gradeable, tint.animated (a field to change has keys) or tint.invalid_grade / tint.sealed (the result isn't valid, or a layer can't be added).",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string().min(1)).min(1).optional(),
    targets: z.array(targetSchema).min(1).optional(),
    tools: z.array(z.enum(TOOL_IDS)).min(1).optional(),
  }),
  run(ctx, { clipIds, targets, tools }) {
    const copied = ctx.require(tintRef).clipboard.get(ctx.actor);
    if (!copied) throw new CommandFailure("tint.clipboard_empty", "No grade has been copied.");
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    const writes: [GradeTarget, ClipGrade | undefined][] = [];
    for (const target of targetsOf(clipIds, targets)) {
      const before = readGrade(state, target);
      let next: ClipGrade;
      if (tools) {
        let part;
        try {
          part = pastePart(before, copied, tools, () => createId("node"));
        } catch (error) {
          throw new CommandFailure(
            "tint.sealed",
            `A layer can't be added to ${targetName(target)}: ${error instanceof Error ? error.message : error}`,
          );
        }
        for (const [id, fields] of Object.entries(part.changed)) {
          refuseUnlessEditable(state, target, before, id, fields);
        }
        next = part.grade;
        for (const id of Object.keys(part.changed)) checkNodeLut(state, next.nodes[id]);
      } else {
        // The camera color space belongs to the footage, not the grade: the clip keeps its own.
        next = structuredClone(copied);
        for (const node of Object.values(next.nodes)) checkNodeLut(state, node);
        if (before?.input) next.input = before.input;
        else delete next.input;
      }
      const stored = checkedGrade(next);
      if (JSON.stringify(stored ?? null) !== JSON.stringify(before)) writes.push([target, stored]);
    }
    if (writes.length === 0) return { pasted: 0 };
    ctx.mutate(store, (draft) => {
      for (const [target, grade] of writes) {
        writeGrade(draft, target, grade);
        if (!tools) dropTracks(draft, target, () => true);
      }
    });
    return { pasted: writes.length };
  },
});
