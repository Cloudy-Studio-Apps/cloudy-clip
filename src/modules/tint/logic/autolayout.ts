import type { ClipGrade, GradePos, GradeNodeId } from "@/modules/project";
import { gradeInputs, gradeKeys } from "@/modules/project";
import { topoOrder } from "./order";

/** Graph units between columns and between rows of the auto-layout. */
const COLUMN = 150;
const ROW = 100;

/**
 * Places for the nodes that have no `pos`: one column per step from the source (a node one column
 * right of the furthest picture or key it reads; the source is column 0), stacked down each column
 * in evaluation order (`topoOrder`). Nodes with a `pos` keep it and are not returned.
 */
export function autoLayout(grade: ClipGrade): Record<GradeNodeId, GradePos> {
  const column = new Map<string, number>([["source", 0]]);
  const rows = new Map<number, number>();
  const placed: Record<GradeNodeId, GradePos> = {};
  for (const id of topoOrder(grade)) {
    const node = grade.nodes[id]!;
    const reads = [...gradeInputs(node).map((ref) => ref.node), ...gradeKeys(node)];
    const at = 1 + Math.max(0, ...reads.map((read) => column.get(read) ?? 0));
    column.set(id, at);
    if (node.pos) continue;
    const row = rows.get(at) ?? 0;
    rows.set(at, row + 1);
    placed[id] = { x: at * COLUMN, y: row * ROW };
  }
  return placed;
}
