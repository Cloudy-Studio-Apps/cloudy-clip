import { z } from "zod";
import { CommandFailure, createId, defineCommand } from "@/core";
import { projectRef } from "@/modules/project";
import { linkPair, sameTiming } from "./logic/links";
import { requireClip } from "./timeline.guards";

/** Links a picture and its sound again: the opposite of `timeline.unlinkClips`. */
export const linkClips = defineCommand({
  id: "timeline.linkClips",
  label: "Link audio",
  description:
    "Links one clip on a video track and one on an audio track again, undoing an unlink, so they move, trim, split and delete together. Both must be unlinked and from the same file, at the same start, length and source position; otherwise fails with timeline.link_mismatch. Returns { linkId }.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).length(2) }),
  run(ctx, { clipIds }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const pair = linkPair(state, clipIds);
    if (!pair || !sameTiming(pair)) {
      throw new CommandFailure(
        "timeline.link_mismatch",
        "Only a picture and a sound from the same file, at the same time and length, can be linked.",
      );
    }
    const linkId = createId("link");
    ctx.mutate(store, (draft) => {
      for (const id of clipIds) draft.clips[id]!.linkId = linkId;
    });
    return { linkId };
  },
});
