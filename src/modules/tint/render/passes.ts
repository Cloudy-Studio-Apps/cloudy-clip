import type { GpuPass } from "@/modules/preview";
import type { ClipGrade } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import { prepareCorrection } from "../logic/color/correct";
import { gradeChain } from "../logic/color/evaluate";
import { withLive } from "../logic/live";
import type { LiveGrade } from "../tint.types";
import { correctPass } from "./correct.glsl";

/**
 * A clip's grade, with live values laid over it, as GPU passes: one per correction that is on and
 * shows (opacity above 0), in `gradeChain` order, each reading the one before. No passes for a
 * grade that changes nothing. Joins and splits aren't drawn yet (see `gradeChain`); never throws
 * for a grade's shape.
 */
export function gradePasses(grade: ClipGrade, live: LiveGrade | undefined): GpuPass[] {
  const passes: GpuPass[] = [];
  for (const { node } of gradeChain(withLive(grade, live))) {
    if (!node.on || node.opacity <= 0) continue;
    const params = prepareCorrection(correctionOf(node));
    passes.push(correctPass(params, Math.min(node.opacity, 1), passes.length - 1));
  }
  return passes;
}
