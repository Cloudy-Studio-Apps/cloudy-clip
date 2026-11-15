import { useMemo, useRef, useState } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { setGroup } from "../tint.group.commands";
import { addCorrection, setCorrection } from "../tint.node.commands";
import { tintRef } from "../tint.ref";
import type { LiveNode } from "../tint.types";
import { settle } from "./settle";
import type { EditPatch, GradeSubject, LiveEdit } from "./ui.types";

/**
 * Edits one correction of a grade (`subject`: a clip's, a shot group's or the whole timeline's) the way every drag on the page does: `preview` lays
 * the values over the picture without touching the document, and `commit` sends one
 * `tint.setCorrection` (one undo step; at the clip level with `at` the playhead, so a keyed number
 * gets a key there through `keyframe.set` instead of a static value), then drops the live values. With no correction yet
 * (`nodeId` null) the first commit adds one with those values (`tint.addCorrection`), and nothing
 * can be previewed, as there is no layer to lay it over. A refusal is shown to the user and bumps
 * `rev`, so a control keyed by it shows the saved values again. With `group`, `nodeId` is a
 * side-by-side or stacked group's join, and `commit` sends `tint.setGroup` (opacity, on, blends).
 */
export function useLiveEdit(
  subject: GradeSubject | null,
  nodeId: string | null,
  group = false,
): LiveEdit {
  const { bus } = useKernel();
  const tint = useModule(tintRef);
  const { playback } = useModule(previewRef);
  const [rev, setRev] = useState(0);
  const live = useRef<LiveNode>({});
  return useMemo(() => {
    const id = subject?.id;
    const clear = () => {
      live.current = {};
      if (id) tint.live.set(id, null);
    };
    return {
      enabled: subject !== null,
      rev,
      preview(patch) {
        if (!id || !nodeId) return;
        live.current = {
          ...live.current,
          ...patch.values,
          ...(patch.opacity !== undefined ? { opacity: patch.opacity } : {}),
          ...(patch.on !== undefined ? { on: patch.on } : {}),
          ...(patch.limit !== undefined ? { limit: patch.limit } : {}),
          ...(patch.lut !== undefined ? { lut: patch.lut } : {}),
          ...(patch.blends !== undefined ? { blends: patch.blends } : {}),
        };
        tint.live.set(id, { nodes: { [nodeId]: live.current } });
      },
      async commit(patch: EditPatch) {
        if (!subject) return;
        const { target } = subject;
        if (nodeId && group) {
          const { opacity, on, blends } = patch;
          const result = await settle(
            bus.run(setGroup, { target, joinId: nodeId, patch: { opacity, on, blends } }),
          );
          clear();
          if (!result.ok) setRev((n) => n + 1);
        } else if (nodeId) {
          // A clip's keyed numbers take a key at the playhead, in the same step.
          const at = subject.level === "clip" ? playback.getTime() : undefined;
          const result = await settle(bus.run(setCorrection, { target, at, nodeId, patch }));
          clear();
          if (!result.ok) setRev((n) => n + 1);
        } else if (patch.values || patch.limit || patch.lut) {
          const { values, limit, lut } = patch;
          const result = await settle(
            bus.run(addCorrection, {
              target,
              values,
              limit: limit ?? undefined,
              lut: lut ?? undefined,
            }),
          );
          clear();
          if (result.ok) tint.view.setState({ selected: result.value.nodeId });
          else setRev((n) => n + 1);
        }
      },
      cancel: clear,
    } satisfies LiveEdit;
  }, [bus, tint, playback, subject, nodeId, group, rev]);
}
