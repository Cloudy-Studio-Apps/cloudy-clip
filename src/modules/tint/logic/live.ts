import type { ClipGrade, GradeNode } from "@/modules/project";
import type { LiveGrade } from "../tint.types";

/**
 * The grade with live values laid over it: each live node's values over its saved ones (a field
 * replaced whole), its `opacity` and `on`. Live values for a node that isn't a correction, or isn't
 * there, are ignored. The saved grade is not changed.
 */
export function withLive(grade: ClipGrade, live: LiveGrade | undefined): ClipGrade {
  if (!live) return grade;
  const nodes: Record<string, GradeNode> = { ...grade.nodes };
  for (const [id, over] of Object.entries(live.nodes)) {
    const node = nodes[id];
    if (node?.kind !== "correct") continue;
    const { opacity, on, ...values } = over;
    nodes[id] = {
      ...node,
      ...(opacity !== undefined && { opacity }),
      ...(on !== undefined && { on }),
      values: { ...node.values, ...values },
    };
  }
  return { ...grade, nodes };
}
