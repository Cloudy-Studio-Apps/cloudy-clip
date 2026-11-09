import type { GpuPass } from "@/modules/preview";
import type { ClipGrade, GradeNodeId } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import { prepareCorrection } from "../logic/color/correct";
import { gradeChain } from "../logic/color/evaluate";
import { prepareLimit } from "../logic/color/limit";
import { withLive } from "../logic/live";
import type { GradeTextures, LiveGrade } from "../tint.types";
import { correctPass } from "./correct.glsl";
import { keyPasses, showPass } from "./limit.glsl";

/**
 * A clip's grade, with live values laid over it, as GPU passes: one per correction that is on and
 * shows (opacity above 0), in `gradeChain` order, each reading the one before. A correction whose
 * limit limits something (`prepareLimit`) first gets its key passes over that same input
 * (`keyPasses`: the key, and two blur passes for refine softness), then mixes by the key. No passes
 * for a grade that changes nothing. Joins and splits aren't drawn yet (see `gradeChain`); never
 * throws for a grade's shape. The curve step and the warper are baked through `textures` (the
 * filter's, so they are baked again only when they change), keyed by node. `aspect` is the
 * picture's width over its height, for the vignette and the key's blur. With `show` (a correction
 * of the chain, on or off), the passes stop there with its key as white on black (Limit's Show).
 */
export function gradePasses(
  grade: ClipGrade,
  live: LiveGrade | undefined,
  textures: GradeTextures,
  aspect: number,
  show?: GradeNodeId | null,
): GpuPass[] {
  const passes: GpuPass[] = [];
  let last = -1;
  for (const { id, node } of gradeChain(withLive(grade, live))) {
    const showing = id === show;
    if (!showing && (!node.on || node.opacity <= 0)) continue;
    const limit = prepareLimit(node.limit);
    if (limit) passes.push(...keyPasses(limit, last, passes.length, aspect));
    const key = passes.length - 1;
    if (showing) {
      passes.push(showPass(limit, last, key));
      return passes;
    }
    const values = correctionOf(node);
    const curves = textures.curves(values, `tint.curves:${id}`);
    const warper = textures.warper(values.warper, `tint.warper:${id}`);
    const params = prepareCorrection(values, curves?.table ?? null, warper?.table ?? null);
    passes.push(
      correctPass(
        params,
        Math.min(node.opacity, 1),
        last,
        aspect,
        { curves: curves?.texture, warper: warper?.texture },
        limit ? { key, params: limit } : undefined,
      ),
    );
    last = passes.length - 1;
  }
  return passes;
}
