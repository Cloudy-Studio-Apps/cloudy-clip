import type { ClipGrade, NodeRef } from "@/modules/project";
import type { GraphPlaced as Placed, GraphPoint, WireDrop, WireEntry } from "../tint.types";
import { graphEnds, nodeBox } from "./graph";

/** How far (graph units) past a node's box, or from Out's dot, a wire still lands on it. */
const REACH = 8;
const OUT_REACH = 16;

/** What a wire dropped at `point` lands on: Out, or a node (on a channel join, the channel by height), else nothing. */
export function dropTarget(
  grade: ClipGrade,
  placed: Record<string, Placed>,
  point: GraphPoint,
): WireDrop | null {
  const out = graphEnds(placed).out;
  if (Math.hypot(point[0] - out[0], point[1] - out[1]) <= OUT_REACH) return { nodeId: "out" };
  for (const [nodeId, node] of Object.entries(placed)) {
    const b = nodeBox(node);
    const inside =
      point[0] >= b.x - REACH &&
      point[0] <= b.x + b.width + REACH &&
      point[1] >= b.y - REACH &&
      point[1] <= b.y + b.height + REACH;
    if (!inside) continue;
    if (grade.nodes[nodeId]?.kind !== "join") return { nodeId };
    const third = Math.floor(((point[1] - b.y) / b.height) * 3);
    return { nodeId, channel: (["r", "g", "b"] as const)[Math.min(2, Math.max(0, third))] };
  }
  return null;
}

/** The `tint.wire` entry that makes `drop` read `ref`: replaces a single input, adds to a join's list. Not validated: the command is the one rule. */
export function wireEntry(grade: ClipGrade, drop: WireDrop, ref: NodeRef): WireEntry {
  const { nodeId } = drop;
  const node = grade.nodes[nodeId];
  if (nodeId === "out" || !node) return { nodeId, input: ref };
  switch (node.kind) {
    case "parallel":
    case "layer":
      return { nodeId, inputs: [...node.inputs, ref] };
    case "join":
      return { nodeId, [drop.channel ?? "r"]: ref };
    case "keyJoin":
      return { nodeId, keys: [...node.keys, { from: ref.node, mode: "add" }] };
    default:
      return { nodeId, input: ref };
  }
}
