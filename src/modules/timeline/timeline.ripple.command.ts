import { z } from "zod";
import { defineCommand } from "@/core";
import { applyMoves, projectRef, withPartners } from "@/modules/project";
import { rippleDeleteMoves } from "./logic/ripple";
import { checkLayout, requireClip } from "./timeline.guards";
import { commitState, followMove, junctionKindOf } from "./timeline.junctions";
import { withoutClips } from "./timeline.split.commands";

/** Deletes clips and closes the time they freed on their tracks. */
export const rippleDelete = defineCommand({
  id: "timeline.rippleDelete",
  label: "Ripple delete",
  description:
    "Deletes clips and their linked clips, then closes the time they freed on each track that lost a clip: what follows moves earlier, with its linked clips. Time another clip still covers (under a junction) isn't freed, and gaps that were already there stay. A linked group moves together by the smallest shift among its clips on those tracks. Junctions on the deleted clips go. Fails with timeline.overlap, changing nothing, if something would land on another clip. Returns { deleted, removedJunctions }.",
  undoable: true,
  input: z.object({ clipIds: z.array(z.string()).min(1) }),
  run(ctx, { clipIds }) {
    const state = ctx.require(projectRef).store.getState();
    clipIds.forEach((id) => requireClip(state, id));
    const all = withPartners(state, clipIds);
    const moves = rippleDeleteMoves(state, new Set(all));
    const { next: without, removedJunctions } = withoutClips(state, all);
    const movedIds = moves.map((move) => move.clipId);
    const { state: next, removed } = followMove(
      applyMoves(without, moves),
      movedIds,
      junctionKindOf(ctx),
    );
    checkLayout(next, new Set(movedIds));
    commitState(ctx, state, next);
    return { deleted: all.length, removedJunctions: [...removedJunctions, ...removed] };
  },
});
