import type { Correction, GradeNodeId } from "@/modules/project";
import type { LayerChipInfo, StackItem } from "../tint.types";

/** What a correction changes, for its chip. */
export function layerChip(node: Correction): LayerChipInfo {
  if (node.lut) return { kind: "lut", label: "LUT" };
  const { limit } = node;
  if (limit?.from) return { kind: "key", label: "Shared key" };
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
