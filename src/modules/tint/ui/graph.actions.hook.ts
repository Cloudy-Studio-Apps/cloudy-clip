import { useMemo } from "react";
import { createId, notify, useKernel, useModule } from "@/core";
import type { ClipGrade } from "@/modules/project";
import { tidyLayout } from "../logic/graph";
import { group } from "../tint.group.commands";
import { resetGrade } from "../tint.commands";
import { addCorrection, removeNodes } from "../tint.node.commands";
import { tintRef } from "../tint.ref";
import { placeNodes, wire } from "../tint.wire.commands";
import type { GradeTarget, GraphPlaced as Placed } from "../tint.types";
import { settle } from "./settle";
import type { GraphActions } from "./ui.types";

/** The node graph's actions on a grade, through the command bus. A refusal is shown to the user. */
export function useGraphActions(
  target: GradeTarget,
  grade: ClipGrade,
  placed: Record<string, Placed>,
): GraphActions {
  const { bus } = useKernel();
  const tint = useModule(tintRef);
  return useMemo(() => {
    const select = (id: string) => tint.view.setState({ selected: id });
    const place = async (pos: Record<string, { x: number; y: number }>) =>
      (await settle(bus.run(placeNodes, { target, pos }))).ok;
    return {
      // Everything else stays where it is drawn: unplaced nodes would otherwise shift.
      place: (moved) =>
        place({
          ...Object.fromEntries(Object.entries(placed).map(([id, { x, y }]) => [id, { x, y }])),
          ...moved,
        }),
      async wire(entry) {
        return (await settle(bus.run(wire, { target, set: [entry] }))).ok;
      },
      async addCorrection([x, y]) {
        const selected = tint.view.getState().selected;
        const result = await settle(
          bus.run(addCorrection, {
            target,
            at:
              selected && grade.nodes[selected]?.kind === "correct"
                ? { before: selected }
                : undefined,
          }),
        );
        if (!result.ok) return;
        const { nodeId } = result.value;
        await place({
          ...Object.fromEntries(Object.entries(placed).map(([id, p]) => [id, { x: p.x, y: p.y }])),
          [nodeId]: { x: x - 58, y: y - 41 },
        });
        select(nodeId);
      },
      async group(nodeIds, kind) {
        const result = await settle(bus.run(group, { target, nodeIds, kind }));
        if (result.ok) select(result.value.joinId);
      },
      async sharedKey([x, y]) {
        const from = tint.view.getState().selected;
        if (!from || grade.nodes[from]?.kind !== "correct") {
          notify("error", "Select the correction whose key you want to share first.");
          return;
        }
        const id = createId("node");
        const result = await settle(
          bus.run(wire, {
            target,
            set: [],
            add: [
              {
                id,
                node: {
                  kind: "keyJoin",
                  keys: [{ from, mode: "add" }],
                  pos: { x: x - 20, y: y - 20 },
                },
              },
            ],
          }),
        );
        if (result.ok) select(id);
      },
      remove: (nodeId) => void settle(bus.run(removeNodes, { target, nodeIds: [nodeId] })),
      tidy: () => void settle(bus.run(placeNodes, { target, pos: tidyLayout(grade) })),
      reset: () => void settle(bus.run(resetGrade, { target })),
    } satisfies GraphActions;
  }, [bus, tint, target, grade, placed]);
}
