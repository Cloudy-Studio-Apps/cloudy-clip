import { Folder, Key, Layers, LayoutGrid, Plus, RotateCcw, Rows3, Unlink } from "lucide-react";
import type { MenuItem } from "@/ui";
import type { GraphActions } from "./ui.types";

type GroupKind = "parallel" | "layer" | "channels";

/**
 * The node view's right-click menu: Correction, Side by side, Stacked, Shared key and Per channel
 * add to the grade (the groups wrap the selection, as Baby Seal's + Add does; `picks` are the ids a
 * group would take, null when there are none), Remove wire shows when the right-click was on a
 * wire that can lose one input, Reset grade and Tidy up change the whole.
 */
export function nodeMenu(
  actions: GraphActions,
  picks: Record<GroupKind, string[] | null>,
  at: readonly [number, number],
  removeWire?: () => void,
): readonly MenuItem[] {
  const add = (label: string, icon: MenuItem["icon"], kind: GroupKind): MenuItem => {
    const ids = picks[kind];
    return {
      label,
      icon,
      group: "add",
      disabled: !ids,
      onSelect: () => ids && void actions.group(ids, kind),
    };
  };
  return [
    ...(removeWire
      ? [{ label: "Remove wire", icon: Unlink, group: "wire", onSelect: removeWire }]
      : []),
    {
      label: "Correction",
      icon: Plus,
      group: "add",
      onSelect: () => void actions.addCorrection(at),
    },
    add("Side by side", Folder, "parallel"),
    add("Stacked", Layers, "layer"),
    { label: "Shared key", icon: Key, group: "add", onSelect: () => void actions.sharedKey(at) },
    add("Per channel", Rows3, "channels"),
    { label: "Reset grade", icon: RotateCcw, group: "graph", onSelect: actions.reset },
    { label: "Tidy up", icon: LayoutGrid, group: "graph", onSelect: actions.tidy },
  ];
}
