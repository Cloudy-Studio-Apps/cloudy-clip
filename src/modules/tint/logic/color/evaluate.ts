import type { ClipGrade, GradeNodeId } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import type { GradeOps, PixelAt, Rgb } from "../../tint.types";
import { walkGrade } from "../walk";
import { correctPixel } from "./correct";
import { channelRgb, joinRgb, keyJoinValue, layerRgb, parallelRgb } from "./joins";
import { finishKey, rawKey } from "./limit";
import { toRec709 } from "./spaces";

/**
 * A pixel of `source` through a grade, as the passes draw it (`walkGrade`): each correction mixed
 * over its input by its opacity times its key (its own or a shared one: `rawKey` read from the
 * picking correction's input, then `finishKey`; the refine blur can't be had per pixel, so it is
 * left out), key joins combining their entries' finished keys and groups put back together as
 * `joins.ts` says. The source is first turned into Rec.709 from the grade's `input` (`toRec709`,
 * with `videoRange` as `gradePasses` takes it), as the passes' first one does. With `stopAt` a correction, what
 * it reads (the pixel before it); anything else gives the whole grade's result.
 */
export function evaluatePixel(
  grade: ClipGrade,
  source: Rgb,
  at: PixelAt,
  stopAt?: GradeNodeId,
  videoRange = true,
): Rgb {
  const ops: GradeOps<Rgb, number> = {
    source: toRec709(source, grade.input ?? "rec709", videoRange),
    channel: channelRgb,
    key: (params, input) => rawKey(input, params),
    correct(_id, node, input, key) {
      const out = correctPixel(input, correctionOf(node), at);
      const a = node.opacity * (key ? finishKey(key.key, key.params) : 1);
      return [
        input[0] + (out[0] - input[0]) * a,
        input[1] + (out[1] - input[1]) * a,
        input[2] + (out[2] - input[2]) * a,
      ];
    },
    parallel: parallelRgb,
    layer: layerRgb,
    join: joinRgb,
    keyJoin: (keys) =>
      keyJoinValue(
        keys.map(({ key, mode }) => ({ k: key ? finishKey(key.key, key.params) : 1, mode })),
      ),
  };
  const walk = walkGrade(grade, ops);
  const stop = stopAt === undefined ? undefined : grade.nodes[stopAt];
  return walk.picture(stop?.kind === "correct" ? stop.input : grade.out);
}
