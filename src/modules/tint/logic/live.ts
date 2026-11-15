import type { ClipGrade, Correction, GradeNode } from "@/modules/project";
import type { LiveGrade } from "../tint.types";

/**
 * The grade with live values laid over it: each live correction's values over its saved ones (a
 * field replaced whole), its `opacity`, `on`, `limit` and `lut` (null: none); a live group's join its
 * `opacity`, `on` and (stacked) `blends`. Live values for another node, or one that isn't there,
 * are ignored. The saved grade is not changed.
 */
export function withLive(grade: ClipGrade, live: LiveGrade | undefined): ClipGrade {
  if (!live) return grade;
  const nodes: Record<string, GradeNode> = { ...grade.nodes };
  for (const [id, over] of Object.entries(live.nodes)) {
    const node = nodes[id];
    if (node?.kind === "parallel" || node?.kind === "layer") {
      const { opacity, on, blends } = over;
      nodes[id] = {
        ...node,
        ...(opacity !== undefined && { opacity }),
        ...(on !== undefined && { on }),
        ...(node.kind === "layer" && blends && { blends }),
      };
      continue;
    }
    if (node?.kind !== "correct") continue;
    const { opacity, on, limit, lut, ...values } = over;
    delete values.blends;
    const next: Correction = {
      ...node,
      ...(opacity !== undefined && { opacity }),
      ...(on !== undefined && { on }),
      ...(limit && { limit }),
      ...(lut && { lut }),
      values: { ...node.values, ...values },
    };
    if (limit === null) delete next.limit;
    if (lut === null) delete next.lut;
    nodes[id] = next;
  }
  return { ...grade, nodes };
}
