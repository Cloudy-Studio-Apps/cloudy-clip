import type { GpuPass } from "@/modules/preview";
import type { ClipGrade } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import { prepareCorrection } from "../logic/color/correct";
import { gradeChain } from "../logic/color/evaluate";
import { withLive } from "../logic/live";
import type { GradeTextures, LiveGrade } from "../tint.types";
import { correctPass } from "./correct.glsl";

/**
 * A clip's grade, with live values laid over it, as GPU passes: one per correction that is on and
 * shows (opacity above 0), in `gradeChain` order, each reading the one before. No passes for a
 * grade that changes nothing. Joins and splits aren't drawn yet (see `gradeChain`); never throws
 * for a grade's shape. The curve step and the warper are baked through `textures` (the filter's, so
 * they are baked again only when they change), keyed by node. `aspect` is the picture's width over
 * its height, for the vignette.
 */
export function gradePasses(
  grade: ClipGrade,
  live: LiveGrade | undefined,
  textures: GradeTextures,
  aspect: number,
): GpuPass[] {
  const passes: GpuPass[] = [];
  for (const { id, node } of gradeChain(withLive(grade, live))) {
    if (!node.on || node.opacity <= 0) continue;
    const values = correctionOf(node);
    const curves = textures.curves(values, `tint.curves:${id}`);
    const warper = textures.warper(values.warper, `tint.warper:${id}`);
    const params = prepareCorrection(values, curves?.table ?? null, warper?.table ?? null);
    passes.push(
      correctPass(params, Math.min(node.opacity, 1), passes.length - 1, aspect, {
        curves: curves?.texture,
        warper: warper?.texture,
      }),
    );
  }
  return passes;
}
