import { useMemo, useRef, useState } from "react";
import { useKernel, useModule } from "@/core";
import type { ClipId } from "@/modules/project";
import { setGroup } from "../tint.group.commands";
import { addCorrection, setCorrection } from "../tint.node.commands";
import { tintRef } from "../tint.ref";
import type { LiveNode } from "../tint.types";
import { settle } from "./settle";
import type { EditPatch, LiveEdit } from "./ui.types";

/**
 * Edits one correction of a clip's own grade the way every drag on the page does: `preview` lays
 * the values over the picture without touching the document, and `commit` sends one
 * `tint.setCorrection` (one undo step), then drops the live values. With no correction yet
 * (`nodeId` null) the first commit adds one with those values (`tint.addCorrection`), and nothing
 * can be previewed, as there is no layer to lay it over. A refusal is shown to the user and bumps
 * `rev`, so a control keyed by it shows the saved values again. With `group`, `nodeId` is a
 * side-by-side or stacked group's join, and `commit` sends `tint.setGroup` (opacity, on, blends).
 */
export function useLiveEdit(clipId: ClipId | null, nodeId: string | null, group = false): LiveEdit {
  const { bus } = useKernel();
  const tint = useModule(tintRef);
  const [rev, setRev] = useState(0);
  const live = useRef<LiveNode>({});
  return useMemo(() => {
    const clear = () => {
      live.current = {};
      if (clipId) tint.live.set(clipId, null);
    };
    return {
      enabled: clipId !== null,
      rev,
      preview(patch) {
        if (!clipId || !nodeId) return;
        live.current = {
          ...live.current,
          ...patch.values,
          ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
          ...(patch.on !== undefined ? { on: patch.on } : {}),
          ...(patch.limit !== undefined ? { limit: patch.limit } : {}),
          ...(patch.blends !== undefined ? { blends: patch.blends } : {}),
        };
        tint.live.set(clipId, { nodes: { [nodeId]: live.current } });
      },
      async commit(patch: EditPatch) {
        if (!clipId) return;
        const target = { clipId };
        if (nodeId && group) {
          const { opacity, on, blends } = patch;
          const result = await settle(
            bus.run(setGroup, { target, joinId: nodeId, patch: { opacity, on, blends } }),
          );
          clear();
          if (!result.ok) setRev((n) => n + 1);
        } else if (nodeId) {
          const result = await settle(bus.run(setCorrection, { target, nodeId, patch }));
          clear();
          if (!result.ok) setRev((n) => n + 1);
        } else if (patch.values || patch.limit) {
          const { values, limit } = patch;
          const result = await settle(
            bus.run(addCorrection, { target, values, limit: limit ?? undefined }),
          );
          clear();
          if (result.ok) tint.view.setState({ selected: result.value.nodeId });
          else setRev((n) => n + 1);
        }
      },
      cancel: clear,
    } satisfies LiveEdit;
  }, [bus, tint, clipId, nodeId, group, rev]);
}
