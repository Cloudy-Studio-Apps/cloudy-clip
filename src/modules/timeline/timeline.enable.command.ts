import { z } from "zod";
import { defineCommand } from "@/core";
import { projectRef, withPartners } from "@/modules/project";
import { requireClip } from "./timeline.guards";

/** Turns clips off and on: an off clip stays on the timeline but isn't seen or heard. */
export const setClipsDisabled = defineCommand({
  id: "timeline.setClipsDisabled",
  label: "Disable clip",
  description:
    "Turns clips off (disabled: true) or back on (disabled: false). An off clip stays on the timeline, keeping its place and its junctions, but isn't seen or heard in preview or export; a transition next to it doesn't play. Linked clips change together.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1), disabled: z.boolean() }),
  run(ctx, { clipIds, disabled }) {
    const { store } = ctx.require(projectRef);
    const state = store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    ctx.mutate(store, (draft) => {
      for (const id of withPartners(state, clipIds)) {
        const clip = draft.clips[id]!;
        if (disabled) clip.disabled = true;
        else delete clip.disabled;
      }
    });
  },
});
