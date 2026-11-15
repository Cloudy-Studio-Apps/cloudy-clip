import type { ClipGrade, NodeRef } from "@/modules/project";
import { TINT_LAYOUT } from "../tint.layout";
import type { GraphPlaced as Placed, GraphPoint, GraphView } from "../tint.types";
import { autoLayout } from "./autolayout";

const CHANNELS = ["r", "g", "b"] as const;

/** The box a node takes, in graph units. */
export function nodeBox({ kind, x, y }: Placed): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (kind === "correct") return { x, y, ...TINT_LAYOUT.node };
  return { x, y, width: TINT_LAYOUT.joint, height: TINT_LAYOUT.joint };
}

/** Where `slot` of `count` ports sits down a node's edge (the middle for one). */
function portY(node: Placed, slot: number, count: number): number {
  const b = nodeBox(node);
  return b.y + (b.height * (slot + 1)) / (count + 1);
}

/** Where wires leave a node (its right edge, middle; a split has one port per channel). */
export function outPort(node: Placed, channel?: "r" | "g" | "b"): GraphPoint {
  const b = nodeBox(node);
  const split = node.kind === "split" && channel;
  return [b.x + b.width, split ? portY(node, CHANNELS.indexOf(channel), 3) : b.y + b.height / 2];
}

/** Where wires enter a node (its left edge, middle; a channel join has one port per channel). */
export function inPort(node: Placed, channel?: "r" | "g" | "b"): GraphPoint {
  const b = nodeBox(node);
  const join = node.kind === "join" && channel;
  return [b.x, join ? portY(node, CHANNELS.indexOf(channel), 3) : b.y + b.height / 2];
}

/** Every node of a grade where it sits: its own place, else the automatic one. */
export function placeAll(grade: ClipGrade): Record<string, Placed> {
  const auto = autoLayout(grade);
  const placed: Record<string, Placed> = {};
  for (const [id, node] of Object.entries(grade.nodes)) {
    const at = node.pos ?? auto[id] ?? { x: 0, y: 0 };
    placed[id] = { kind: node.kind, x: at.x, y: at.y };
  }
  return placed;
}

/** Places for every node as `autoLayout` would give them, ignoring the ones the user set. */
export function tidyLayout(grade: ClipGrade): Record<string, { x: number; y: number }> {
  const nodes = Object.fromEntries(
    Object.entries(grade.nodes).map(([id, node]) => [id, { ...node, pos: undefined }]),
  );
  return autoLayout({ ...grade, nodes });
}

/** The graph's two ends: Source on the left, Out after the last node. */
export function graphEnds(placed: Record<string, Placed>): { source: GraphPoint; out: GraphPoint } {
  const right = Math.max(230, ...Object.values(placed).map((n) => nodeBox(n).x + nodeBox(n).width));
  const mid = TINT_LAYOUT.node.height / 2;
  return { source: [30, mid], out: [right + 70, mid] };
}

/** The view that shows every node and both ends. */
export function fitView(placed: Record<string, Placed>): GraphView {
  const ends = graphEnds(placed);
  const boxes = Object.values(placed).map(nodeBox);
  const xs = [ends.source[0] - 40, ends.out[0] + 40, ...boxes.flatMap((b) => [b.x, b.x + b.width])];
  const ys = [-30, ...boxes.flatMap((b) => [b.y - 30, b.y + b.height + 30])];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(TINT_LAYOUT.graph.width / 2, Math.max(...xs) - x),
    height: Math.max(TINT_LAYOUT.graph.height / 2, Math.max(...ys) - y),
  };
}

/** Where a picture ref leaves from. */
export function refPoint(
  placed: Record<string, Placed>,
  ends: ReturnType<typeof graphEnds>,
  ref: NodeRef,
): GraphPoint {
  const node = placed[ref.node];
  return ref.node === "source" || !node ? ends.source : outPort(node, ref.channel);
}
