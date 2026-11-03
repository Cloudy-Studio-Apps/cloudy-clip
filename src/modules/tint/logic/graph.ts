import { TINT_LAYOUT } from "../tint.layout";
import type { GraphPlaced as Placed } from "../tint.types";

/** The box a node takes, in graph units. */
export function nodeBox({ kind, x, y }: Placed): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (kind === "correct") return { x, y, ...TINT_LAYOUT.node };
  if (kind === "channel") return { x, y, ...TINT_LAYOUT.channel };
  return { x, y, width: TINT_LAYOUT.joint, height: TINT_LAYOUT.joint };
}

/** Where wires leave a node (its right edge, middle). */
export function outPort(node: Placed): [number, number] {
  const b = nodeBox(node);
  return [b.x + b.width, b.y + b.height / 2];
}

/** Where wires enter a node (its left edge, middle). */
export function inPort(node: Placed): [number, number] {
  const b = nodeBox(node);
  return [b.x, b.y + b.height / 2];
}

/** The graph's two ends, Source and Out. */
export const GRAPH_ENDS = { source: [22, 192], out: [1010, 197] } as const;
