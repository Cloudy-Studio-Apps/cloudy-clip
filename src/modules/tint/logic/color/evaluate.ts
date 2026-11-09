import type { ClipGrade, Correction, GradeNode, GradeNodeId, NodeRef } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import type { PixelAt, Rgb } from "../../tint.types";
import { correctPixel } from "./correct";
import { keyOf } from "./limit";

/**
 * The corrections a grade draws, source first, until joins come (Task 18): walking back from
 * `out`, a correction is kept and its input followed; a parallel or layer join follows its first
 * input, a channel join its red one, a split its input (a channel is drawn as the whole picture).
 * Corrections that are off are listed too (drawing skips them). A ref to a missing node, or one already
 * walked (a cycle), ends the walk there, as if it were the source. Never throws.
 */
export function gradeChain(grade: ClipGrade): { id: GradeNodeId; node: Correction }[] {
  const chain: { id: GradeNodeId; node: Correction }[] = [];
  const seen = new Set<string>();
  let ref: NodeRef | undefined = grade.out;
  while (ref && ref.node !== "source" && !seen.has(ref.node)) {
    seen.add(ref.node);
    const id: GradeNodeId = ref.node;
    const node: GradeNode | undefined = grade.nodes[id];
    if (!node) break;
    switch (node.kind) {
      case "correct":
        chain.push({ id, node });
        ref = node.input;
        break;
      case "split":
        ref = node.input;
        break;
      case "join":
        ref = node.r;
        break;
      case "parallel":
      case "layer":
        ref = node.inputs[0];
        break;
      case "keyJoin":
        ref = undefined;
        break;
    }
  }
  return chain.reverse();
}

/**
 * A pixel of `source` through a grade, as the passes draw it: each correction in `gradeChain`
 * order, mixed over its input by its opacity times its limit's key (`keyOf`, read from that
 * input; the refine blur can't be had per pixel, so it is left out). With `stopAt`, what that node reads (the pixel before
 * it); a node not in the chain gives the whole grade's result.
 */
export function evaluatePixel(
  grade: ClipGrade,
  source: Rgb,
  at: PixelAt,
  stopAt?: GradeNodeId,
): Rgb {
  let rgb = source;
  for (const { id, node } of gradeChain(grade)) {
    if (id === stopAt) break;
    if (!node.on) continue;
    const out = correctPixel(rgb, correctionOf(node), at);
    const a = node.opacity * keyOf(rgb, node.limit);
    rgb = [
      rgb[0] + (out[0] - rgb[0]) * a,
      rgb[1] + (out[1] - rgb[1]) * a,
      rgb[2] + (out[2] - rgb[2]) * a,
    ];
  }
  return rgb;
}
