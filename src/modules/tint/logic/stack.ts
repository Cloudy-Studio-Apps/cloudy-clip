import type { ClipGrade, GradeNodeId } from "@/modules/project";
import type { StackItem } from "../tint.types";
import { parseStack } from "./seal";

/** A grade with nothing in it: the source straight to out. */
export function emptyGrade(): ClipGrade {
  return { nodes: {}, out: { node: "source" } };
}

/**
 * A grade as Baby Seal shows it, top (closest to the source) to bottom: layers, groups of
 * branches and sealed cards. Empty for no grade.
 */
export function toStack(grade: ClipGrade | null): StackItem[] {
  return parseStack(grade).items;
}

/**
 * The number each correction shows ("01", "02", …), in stack order, depth first through groups.
 * A sealed card's corrections are numbered too, in evaluation order, so a shared key from one of
 * them can still be named.
 */
export function numberOf(grade: ClipGrade | null): Record<GradeNodeId, string> {
  const numbers: Record<GradeNodeId, string> = {};
  const name = (id: GradeNodeId): void => {
    numbers[id] = String(Object.keys(numbers).length + 1).padStart(2, "0");
  };
  const walk = (items: StackItem[]): void => {
    for (const item of items) {
      if (item.type === "layer") name(item.id);
      else if (item.type === "group") item.branches.forEach(walk);
      else item.nodes.filter((id) => grade?.nodes[id]?.kind === "correct").forEach(name);
    }
  };
  walk(toStack(grade));
  return numbers;
}
