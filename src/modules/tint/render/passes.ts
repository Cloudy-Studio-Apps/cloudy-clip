import type { GpuPass } from "@/modules/preview";
import type { ClipGrade, GradeNodeId } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import { prepareCorrection } from "../logic/color/correct";
import { withLive } from "../logic/live";
import { walkGrade } from "../logic/walk";
import type { GradeOps, GradeTextures, LiveGrade } from "../tint.types";
import { correctPass } from "./correct.glsl";
import {
  channelPass,
  copyPass,
  joinPass,
  keyJoinPass,
  layerPass,
  parallelPass,
} from "./joins.glsl";
import { keyPasses, showPass } from "./limit.glsl";
import { inputPass } from "./spaces.glsl";

/**
 * A clip's grade, with live values laid over it, as GPU passes, in the order `walkGrade` needs
 * them (a chain: source first, each reading the one before): one per correction that is on and
 * shows (opacity above 0); a correction with a key first gets its key passes (`keyPasses`: the
 * key, and two blur passes for refine softness) over the input of the correction that picks it,
 * once however many corrections share it, then mixes by the key; a key join is one pass after its
 * entries' keys, combining them, made once and read by each correction using it. A group is one pass reading the
 * picture its branches start from and each branch (`joins.glsl.ts`); a branch of a per-channel
 * group starts with a pass taking its channel as gray. No passes for a grade that changes nothing;
 * never throws for a grade's shape. The curve step and the warper are baked through `textures`
 * (the filter's, so they are baked again only when they change), keyed by node. `aspect` is the
 * picture's width over its height, for the vignette and the key's blur. With `show` (a
 * correction, on or off), the passes stop there with its key as white on black (Limit's Show).
 * A grade whose `input` is a camera space or sRGB starts with one pass turning the source into
 * Rec.709 (`inputPass`; `videoRange` says whether a camera curve reads the source back as video-range
 * code values), which every node reads as the source; Rec.709 (the default) adds none.
 */
export function gradePasses(
  grade: ClipGrade,
  live: LiveGrade | undefined,
  textures: GradeTextures,
  aspect: number,
  show?: GradeNodeId | null,
  videoRange = true,
): GpuPass[] {
  const passes: GpuPass[] = [];
  const push = (pass: GpuPass) => passes.push(pass) - 1;
  const ops: GradeOps<number, number> = {
    source: grade.input && grade.input !== "rec709" ? push(inputPass(grade.input, videoRange)) : -1,
    channel: (input, channel) => push(channelPass(input, channel)),
    key(params, input) {
      passes.push(...keyPasses(params, input, passes.length, aspect));
      return passes.length - 1;
    },
    correct(id, node, input, key) {
      const values = correctionOf(node);
      const curves = textures.curves(values, `tint.curves:${id}`);
      const warper = textures.warper(values.warper, `tint.warper:${id}`);
      const params = prepareCorrection(values, curves?.table ?? null, warper?.table ?? null);
      return push(
        correctPass(
          params,
          Math.min(node.opacity, 1),
          input,
          aspect,
          { curves: curves?.texture, warper: warper?.texture },
          key ?? undefined,
        ),
      );
    },
    parallel: (entry, branches, opacity) => push(parallelPass(entry, branches, opacity)),
    layer: (entry, branches, blends, opacity) => push(layerPass(entry, branches, blends, opacity)),
    join: (r, g, b) => push(joinPass(r, g, b)),
    keyJoin: (keys) => push(keyJoinPass(keys)),
  };
  const shown = withLive(grade, live);
  const walk = walkGrade(shown, ops);
  const stop = show == null ? undefined : shown.nodes[show];
  if (show != null && stop?.kind === "correct") {
    const input = walk.picture(stop.input);
    const key = walk.key(show);
    passes.push(showPass(key?.params ?? null, input, key?.key ?? input));
    return passes;
  }
  const out = walk.picture(shown.out);
  // Every picture is made when first read, so the result is the last pass; kept safe anyway.
  if (out !== passes.length - 1) passes.push(copyPass(out));
  return passes;
}
