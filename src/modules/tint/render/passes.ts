import type { GpuPass } from "@/modules/preview";
import type { ClipGrade } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import { prepareCorrection } from "../logic/color/correct";
import { gradeChain } from "../logic/color/evaluate";
import { withLive } from "../logic/live";
import type { CurveTextures, LiveGrade } from "../tint.types";
import { correctPass } from "./correct.glsl";
import { createCurveTextures } from "./textures";

/**
 * A clip's grade, with live values laid over it, as GPU passes: one per correction that is on and
 * shows (opacity above 0), in `gradeChain` order, each reading the one before. No passes for a
 * grade that changes nothing. Joins and splits aren't drawn yet (see `gradeChain`); never throws
 * for a grade's shape. Curves are baked through `textures` (the filter's, so they are baked again
 * only when they change; a fresh one by default), keyed by node.
 */
export function gradePasses(
  grade: ClipGrade,
  live: LiveGrade | undefined,
  textures: CurveTextures = createCurveTextures(),
): GpuPass[] {
  const passes: GpuPass[] = [];
  for (const { id, node } of gradeChain(withLive(grade, live))) {
    if (!node.on || node.opacity <= 0) continue;
    const values = correctionOf(node);
    const baked = textures.bake(values.curves, `tint.curves:${id}`);
    const params = prepareCorrection(values, baked?.table ?? null);
    passes.push(correctPass(params, Math.min(node.opacity, 1), passes.length - 1, baked?.texture));
  }
  return passes;
}
