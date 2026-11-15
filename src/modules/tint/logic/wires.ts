import { gradeInputs, gradeKeys, type ClipGrade } from "@/modules/project";
import type { GraphPlaced as Placed, GraphPoint, GraphWire } from "../tint.types";
import { graphEnds, inPort, refPoint } from "./graph";

/** An SVG path for a wire from an output port to an input port: a horizontal S-curve. */
export function wirePath([x1, y1]: GraphPoint, [x2, y2]: GraphPoint): string {
  const reach = Math.max(30, Math.abs(x2 - x1) / 2);
  return `M${x1} ${y1}C${x1 + reach} ${y1} ${x2 - reach} ${y2} ${x2} ${y2}`;
}

/** Every wire of a grade: pictures (by channel when they are one), keys, and the one into Out. */
export function graphWires(grade: ClipGrade, placed: Record<string, Placed>): GraphWire[] {
  const ends = graphEnds(placed);
  const wires: GraphWire[] = [];
  for (const [id, node] of Object.entries(grade.nodes)) {
    const at = placed[id]!;
    gradeInputs(node).forEach((ref, i) => {
      const slot = node.kind === "join" ? (["r", "g", "b"] as const)[i] : undefined;
      wires.push({
        from: ref.node,
        to: id,
        kind: ref.channel ?? slot ?? "picture",
        index: i,
        a: refPoint(placed, ends, ref),
        b: inPort(at, slot),
      });
    });
    gradeKeys(node).forEach((from, index) => {
      const source = placed[from];
      if (source) {
        wires.push({
          from,
          to: id,
          kind: "key",
          index,
          a: refPoint(placed, ends, { node: from }),
          b: inPort(at),
        });
      }
    });
  }
  wires.push({
    from: grade.out.node,
    to: "out",
    kind: grade.out.channel ?? "picture",
    index: 0,
    a: refPoint(placed, ends, grade.out),
    b: ends.out,
  });
  return wires;
}
