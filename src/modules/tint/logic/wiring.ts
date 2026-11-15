import type { ClipGrade, NodeRef } from "@/modules/project";
import type {
  GraphPlaced as Placed,
  GraphPoint,
  GraphWire,
  WireDrop,
  WireEntry,
} from "../tint.types";
import { graphEnds, nodeBox } from "./graph";

/** How far (graph units) past a node's box, or from Out's dot, a wire still lands on it. */
const REACH = 8;
const OUT_REACH = 16;

/** What a wire dropped at `point` lands on (never `from`, the node it left: a click isn't a cycle): Out, or a node (on a channel join, the channel by height), else nothing. */
export function dropTarget(
  grade: ClipGrade,
  placed: Record<string, Placed>,
  point: GraphPoint,
  from: string,
): WireDrop | null {
  const out = graphEnds(placed).out;
  if (Math.hypot(point[0] - out[0], point[1] - out[1]) <= OUT_REACH) return { nodeId: "out" };
  for (const [nodeId, node] of Object.entries(placed)) {
    if (nodeId === from) continue;
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

/**
 * The `tint.wire` entry that takes `wire` away, for what can lose one input: a side by side or
 * stacked group's picture or a key join's key. Null for the rest (a correction, a split, a channel
 * join and Out must read something, so they are rewired, not unwired).
 */
export function unwireEntry(grade: ClipGrade, wire: GraphWire): WireEntry | null {
  const node = grade.nodes[wire.to];
  if (node?.kind === "parallel" || node?.kind === "layer") {
    return { nodeId: wire.to, inputs: node.inputs.filter((_, i) => i !== wire.index) };
  }
  if (node?.kind === "keyJoin") {
    return { nodeId: wire.to, keys: node.keys.filter((_, i) => i !== wire.index) };
  }
  return null;
}
