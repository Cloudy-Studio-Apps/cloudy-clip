import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { projectRef, type Clip } from "@/modules/project";
import { changeVersions } from "./logic/versions";
import { readGrade } from "./tint.guards";

/** Puts clips in a shot group (a new one or an existing one), or takes them out of theirs. */
export const setShotGroup = defineCommand({
  id: "tint.setShotGroup",
  label: "Shot group",
  description:
    "Makes, joins or leaves a shot group: clips in one share a grade that runs after each clip's own (edit it with target { groupId }). group { name } makes a new group of the clips, { id } puts them in an existing one, null takes them out of theirs. A clip is in one group at most, so joining moves it. A group no clip is in any more is deleted, with its grade. Returns { groupId } (none for null). Every clip is checked first; one undo step. Fails with tint.target_not_found (a clip or group id that doesn't exist) or tint.not_gradeable (a clip with no picture to grade).",
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string().min(1)).min(1),
    group: z
      .union([
        z.object({ id: z.string().min(1) }).strict(),
        z.object({ name: z.string().trim().min(1).max(80) }).strict(),
        z.null(),
      ])
      .describe(
        "{ name } makes a new group, { id } joins one (ids from project_get_state's gradeGroups), null leaves.",
      ),
  }),
  run(ctx, { clipIds, group }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    for (const clipId of clipIds) readGrade(state, { clipId });
    if (group && "id" in group && !state.gradeGroups?.[group.id]) {
      throw new CommandFailure("tint.target_not_found", `No shot group "${group.id}"`);
    }
    const name = group && "name" in group ? group.name : undefined;
    const made = name !== undefined;
    const groupId = group === null ? undefined : "id" in group ? group.id : createId("shot");
    const result = groupId === undefined ? {} : { groupId };
    if (!made && clipIds.every((id) => state.clips[id]!.gradeGroup === groupId)) return result;
    ctx.mutate(store, (draft) => {
      if (name !== undefined) {
        draft.gradeGroups = { ...draft.gradeGroups, [groupId!]: { id: groupId!, name } };
      }
      for (const id of clipIds) {
        const clip = draft.clips[id]!;
        if (groupId === undefined) delete clip.gradeGroup;
        else clip.gradeGroup = groupId;
      }
      // A group nobody is in any more goes with project's settle (`dropDeletedGrades`).
    });
    return result;
  },
});

/** Keeps several named grades on a clip and switches between them. */
export const setVersion = defineCommand({
  id: "tint.setVersion",
  label: "Grade version",
  description:
    'Keeps several named versions of a clip\'s grade (the clip shows one; a new clip\'s is "A"). action "create" keeps a copy of the showing grade (and its key tracks) under name and stays on the showing one; "switch" shows version name (the showing grade and its key tracks are kept under the old name and the chosen version\'s come out); "rename" renames name to `to` (the showing one too); "delete" removes name, but not the one showing (tint.version_active: switch first). Names are 1 to 80 characters, trimmed, unique on a clip. Versions are per clip: shot groups and the timeline have none. Every clip is checked first; one undo step; switching to the showing version or renaming to the same name does nothing. Fails with tint.target_not_found, tint.not_gradeable, tint.version_not_found, tint.version_exists, tint.version_active or tint.invalid_name.',
  undoable: true,
  input: z.object({
    clipIds: z.array(z.string().min(1)).min(1),
    action: z.enum(["create", "switch", "rename", "delete"]),
    name: z.string().trim().min(1).max(80),
    to: z.string().trim().min(1).max(80).optional().describe("The new name, for rename."),
  }),
  run(ctx, { clipIds, action, name, to }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    if (action === "rename" && to === undefined) {
      throw new CommandFailure("tint.invalid_name", 'rename needs "to": the new name.');
    }
    // A key of an object that would be read as its prototype is no name.
    if ([name, to].includes("__proto__")) {
      throw new CommandFailure("tint.invalid_name", '"__proto__" is not a version name.');
    }
    // Dry run on copies: every clip is checked before any is written.
    const changing = clipIds.filter((clipId) => {
      readGrade(state, { clipId });
      return changeVersions(structuredClone(state.clips[clipId]!) as Clip, action, name, to);
    });
    if (changing.length === 0) return;
    ctx.mutate(store, (draft) => {
      for (const id of changing) changeVersions(draft.clips[id]!, action, name, to);
    });
  },
});
