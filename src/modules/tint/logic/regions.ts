import { gradeInputs, type ClipGrade } from "@/modules/project";
import type { GraphPlaced as Placed, GraphRegion, StackItem } from "../tint.types";
import { nodeBox } from "./graph";

const PAD = 14;
const TITLE = 18;
const NAMES = { parallel: "Side by side", layer: "Stacked", channels: "Per channel" } as const;

/** Every node an item holds: a group's join, its branches and, per channel, the split. */
function nodesIn(item: StackItem, grade: ClipGrade): string[] {
  if (item.type === "layer") return [item.id];
  if (item.type === "sealed") return item.nodes;
  const join = grade.nodes[item.id];
  const split = join ? gradeInputs(join).flatMap((ref) => (ref.channel ? [ref.node] : [])) : [];
  return [item.id, ...split, ...item.branches.flat().flatMap((inner) => nodesIn(inner, grade))];
}

/** The dashed boxes of the groups and sealed cards Baby Seal shows, nested ones included. */
export function regionsOf(
  items: readonly StackItem[],
  grade: ClipGrade,
  placed: Record<string, Placed>,
): GraphRegion[] {
  return items.flatMap((item): GraphRegion[] => {
    if (item.type === "layer") return [];
    const boxes = nodesIn(item, grade)
      .filter((id) => placed[id])
      .map((id) => nodeBox(placed[id]!));
    const inner =
      item.type === "group" ? item.branches.flatMap((b) => regionsOf(b, grade, placed)) : [];
    if (boxes.length === 0) return inner;
    const x = Math.min(...boxes.map((b) => b.x)) - PAD;
    const y = Math.min(...boxes.map((b) => b.y)) - PAD - TITLE;
    const label = item.type === "group" ? NAMES[item.kind] : "Wired in Leader Seal";
    return [
      {
        id: item.id,
        label,
        x,
        y,
        width: Math.max(...boxes.map((b) => b.x + b.width)) + PAD - x,
        height: Math.max(...boxes.map((b) => b.y + b.height)) + PAD - y,
      },
      ...inner,
    ];
  });
}
