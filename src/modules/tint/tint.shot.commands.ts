import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { projectRef } from "@/modules/project";
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
