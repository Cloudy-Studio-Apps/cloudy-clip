import { useMemo } from "react";
import { tidyLimit } from "../logic/color/limit.edit";
import { useEditTarget } from "./edit.target.hook";
import { useLiveEdit } from "./live.edit.hook";
import type { LimitEdit } from "./ui.types";

/**
 * Edits the limit of the correction the tools edit, through `useLiveEdit`: live while a gesture
 * goes, one `tint.setCorrection` (or `tint.addCorrection` before there is a correction) on
 * commit, none when the limit comes out as saved. A limit left empty is removed.
 */
export function useLimitEdit(): LimitEdit {
  const { clipId, nodeId, grade } = useEditTarget();
  const edit = useLiveEdit(clipId, nodeId);
  const node = nodeId ? grade?.nodes[nodeId] : undefined;
  const limit = node?.kind === "correct" ? node.limit : undefined;
  return useMemo(
    () => ({
      enabled: edit.enabled,
      nodeId,
      limit,
      rev: edit.rev,
      preview: (next) => edit.preview({ limit: tidyLimit(next) }),
      commit(next) {
        const tidy = tidyLimit(next);
        if (JSON.stringify(tidy ?? undefined) === JSON.stringify(limit)) edit.cancel();
        else void edit.commit({ limit: tidy });
      },
      cancel: edit.cancel,
    }),
    [edit, nodeId, limit],
  );
}
