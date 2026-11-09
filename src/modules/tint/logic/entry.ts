import type { ClipGrade, GradeNodeId, NodeRef } from "@/modules/project";
import { gradeInputs } from "@/modules/project";
import { topoOrder } from "./order";

/** A picture as a vertex: a node, or one channel of a split. */
const vertexOf = (ref: NodeRef): string =>
  ref.channel ? `${ref.node}\u0000${ref.channel}` : ref.node;

function refOf(vertex: string): NodeRef {
  const [node, channel] = vertex.split("\u0000") as [string, "r" | "g" | "b" | undefined];
  return channel ? { node, channel } : { node };
}

/**
 * Where each node's pictures come from as one: its immediate dominator, the last picture every
 * picture path from the source to it passes through (a split's channel counts as its own
 * picture). For a side-by-side or stacked group it is the picture its branches start from (the
 * `in` of the join's formula). The source for a node nothing else dominates. Never throws.
 */
export function entryOf(grade: ClipGrade): (id: GradeNodeId) => NodeRef {
  const order: string[] = ["source"];
  const preds = new Map<string, string[]>([["source", []]]);
  const ids = topoOrder(grade);
  for (const id of ids) {
    const inputs = gradeInputs(grade.nodes[id]!);
    for (const ref of inputs) {
      const vertex = vertexOf(ref);
      if (ref.channel && !preds.has(vertex)) preds.set(vertex, [ref.node]);
    }
    preds.set(id, inputs.map(vertexOf));
  }
  // Channels right after their split, so every vertex comes after what it reads.
  for (const id of ids) {
    order.push(id);
    for (const channel of ["r", "g", "b"] as const) {
      const vertex = vertexOf({ node: id, channel });
      if (preds.has(vertex)) order.push(vertex);
    }
  }
  const index = new Map(order.map((vertex, i) => [vertex, i]));
  const dom = new Map<string, Set<string>>();
  for (const vertex of order) {
    const sets = (preds.get(vertex) ?? [])
      .map((from) => dom.get(from))
      .filter((set): set is Set<string> => set !== undefined);
    const [head, ...rest] = sets;
    const mine = new Set(head ? [...head].filter((v) => rest.every((set) => set.has(v))) : []);
    mine.add(vertex);
    dom.set(vertex, mine);
  }
  return (id) => {
    let best = "source";
    for (const vertex of dom.get(id) ?? []) {
      if (vertex !== id && index.get(vertex)! > index.get(best)!) best = vertex;
    }
    return refOf(best);
  };
}
