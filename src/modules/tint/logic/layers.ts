import type { BlendMode, Correction, GradeNodeId } from "@/modules/project";
import type { LayerChipInfo, StackItem } from "../tint.types";

/** What a correction changes, for its chip; a shared key names the layer it uses (`numbers`). */
export function layerChip(
  node: Correction,
  numbers: Record<GradeNodeId, string> = {},
): LayerChipInfo {
  if (node.lut) return { kind: "lut", label: "LUT" };
  const { limit } = node;
  if (limit?.from) {
    const no = numbers[limit.from];
    return { kind: "key", label: no ? `Uses the pick of ${no}` : "Shared key" };
  }
  const color = limit?.color?.on === true;
  const brightness = limit?.brightness?.on === true;
  if (color && brightness) return { kind: "key", label: "Color key + Brightness" };
  if (color) return { kind: "key", label: "Color key" };
  if (brightness) return { kind: "key", label: "Brightness" };
  return { kind: "whole", label: "Whole picture" };
}

/** The ids of every layer in a stack, groups' branches included, top to bottom. */
export function layerIds(items: readonly StackItem[]): GradeNodeId[] {
  const ids: GradeNodeId[] = [];
  for (const item of items) {
    if (item.type === "layer") ids.push(item.id);
    else if (item.type === "group")
      for (const branch of item.branches) ids.push(...layerIds(branch));
  }
  return ids;
}

/** The list (the stack, or a group's branch) that holds the item `id`, and where. */
function listOf(
  items: readonly StackItem[],
  id: string,
): { list: readonly StackItem[]; index: number } | null {
  const index = items.findIndex((item) => item.id === id);
  if (index >= 0) return { list: items, index };
  for (const item of items) {
    if (item.type !== "group") continue;
    for (const branch of item.branches) {
      const found = listOf(branch, id);
      if (found) return found;
    }
  }
  return null;
}

/** The item `id` of a stack (groups' branches searched too), or null. */
export function itemOf(items: readonly StackItem[], id: string): StackItem | null {
  const found = listOf(items, id);
  return found ? found.list[found.index]! : null;
}

/**
 * What + Add's group entries wrap around the selected item: for Side by side and Stacked, it and
 * the item after it in its list (or before it, when it is the last); for Per channel, it alone
 * (into the red branch). Null when there is nothing to wrap, or it would wrap a sealed card.
 */
export function groupPick(
  items: readonly StackItem[],
  selected: string | null,
  kind: "parallel" | "layer" | "channels",
): string[] | null {
  const found = selected ? listOf(items, selected) : null;
  if (!found) return null;
  const { list, index } = found;
  const at = kind === "channels" || list[index + 1] ? index : index - 1;
  const picked = list.slice(Math.max(at, 0), at + (kind === "channels" ? 1 : 2));
  const enough = kind === "channels" ? picked.length === 1 : at >= 0 && picked.length === 2;
  return enough && picked.every((item) => item.type !== "sealed")
    ? picked.map((item) => item.id)
    : null;
}

/** A blend mode's name as menus show it ("softLight" is "Soft Light"). */
export function blendName(mode: BlendMode): string {
  return mode
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/([A-Z])/g, " $1")
    .trim();
}
