import { useMemo } from "react";
import { useKernel, useModule } from "@/core";
import { group, setGroup, ungroup } from "../tint.group.commands";
import { addCorrection, moveLayer, removeNodes, setCorrection } from "../tint.node.commands";
import { tintRef } from "../tint.ref";
import { settle } from "./settle";
import type { GradeTarget } from "../tint.types";
import type { LayerActions } from "./ui.types";

/** The layer list's actions on a grade, through the command bus. A refusal is shown to the user. */
export function useLayerActions(target: GradeTarget): LayerActions {
  const { bus } = useKernel();
  const tint = useModule(tintRef);
  return useMemo(() => {
    return {
      async add(at) {
        const result = await settle(bus.run(addCorrection, { target, at }));
        if (result.ok) tint.view.setState({ selected: result.value.nodeId });
      },
      async group(nodeIds, kind) {
        const result = await settle(bus.run(group, { target, nodeIds, kind }));
        if (result.ok) tint.view.setState({ selected: result.value.joinId });
      },
      ungroup: (joinId) => void settle(bus.run(ungroup, { target, joinId })),
      changeGroup: async (joinId, patch) =>
        (await settle(bus.run(setGroup, { target, joinId, patch }))).ok,
      change: async (nodeId, patch) =>
        (await settle(bus.run(setCorrection, { target, nodeId, patch }))).ok,
      remove: (nodeId) => void settle(bus.run(removeNodes, { target, nodeIds: [nodeId] })),
      move: (nodeId, to) => void settle(bus.run(moveLayer, { target, nodeId, to })),
    };
  }, [bus, tint, target]);
}
