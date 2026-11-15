import type { ClipGrade, Correction, GradeNodeId } from "@/modules/project";
import { correctionOf } from "@/modules/project";
import type { GradeOps, LutLookup, PixelAt, PixelKey, Rgb } from "../../tint.types";
import { applyCube } from "../cube";
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
 * it reads (the pixel before it); anything else gives the whole grade's result. A correction's LUT
 * (found with `lutOf`, as `gradePasses` takes it) is applied after its values (`applyCube`).
 */
export function evaluatePixel(
  grade: ClipGrade,
  source: Rgb,
  at: PixelAt,
  stopAt?: GradeNodeId,
  videoRange = true,
  lutOf: LutLookup = () => null,
): Rgb {
  const walk = walkGrade(grade, pixelOps(grade, source, at, videoRange, lutOf));
  const stop = stopAt === undefined ? undefined : grade.nodes[stopAt];
  return walk.picture(stop?.kind === "correct" ? stop.input : grade.out);
}

/**
 * What correction `nodeId` gets at a pixel when the grade draws: its input and its key (as
 * `evaluatePixel` walks it). Null when it doesn't draw there: off, at opacity 0, or off the
 * picture's path. With `finishCorrection`, a candidate value of that correction can be tried
 * without walking the grade again.
 */
export function correctionInput(
  grade: ClipGrade,
  source: Rgb,
  at: PixelAt,
  nodeId: GradeNodeId,
  videoRange = true,
  lutOf: LutLookup = () => null,
): { input: Rgb; key: PixelKey | null } | null {
  let seen: { input: Rgb; key: PixelKey | null } | null = null;
  const ops = pixelOps(grade, source, at, videoRange, lutOf, (id, input, key) => {
    if (id === nodeId) seen = { input, key };
  });
  walkGrade(grade, ops).picture(grade.out);
  return seen;
}

/**
 * A correction's result over its input, as the passes draw it: its LUT (found with `lutOf`) after
 * its values' result `corrected` (`applyCube`, by strength), then mixed over `input` by its opacity
 * times its key (`finishKey`). The one place this mix is written.
 */
export function finishCorrection(
  node: Correction,
  input: Rgb,
  corrected: Rgb,
  key: PixelKey | null,
  lutOf: LutLookup,
): Rgb {
  let out = corrected;
  const lut = node.lut && node.lut.strength > 0 ? lutOf(node.lut.id) : null;
  if (lut) out = applyCube(out, lut.table, Math.min(node.lut!.strength, 1));
  const a = node.opacity * (key ? finishKey(key.key, key.params) : 1);
  return [
    input[0] + (out[0] - input[0]) * a,
    input[1] + (out[1] - input[1]) * a,
    input[2] + (out[2] - input[2]) * a,
  ];
}

/** The walk's operations on one pixel; `seen` hears each correction that draws, with its input and key. */
function pixelOps(
  grade: ClipGrade,
  source: Rgb,
  at: PixelAt,
  videoRange: boolean,
  lutOf: LutLookup,
  seen?: (id: GradeNodeId, input: Rgb, key: PixelKey | null) => void,
): GradeOps<Rgb, number> {
  return {
    source: toRec709(source, grade.input ?? "rec709", videoRange),
    channel: channelRgb,
    key: (params, input) => rawKey(input, params),
    correct(id, node, input, key) {
      seen?.(id, input, key);
      return finishCorrection(node, input, correctPixel(input, correctionOf(node), at), key, lutOf);
    },
    parallel: parallelRgb,
    layer: layerRgb,
    join: joinRgb,
    keyJoin: (keys) =>
      keyJoinValue(
        keys.map(({ key, mode }) => ({ k: key ? finishKey(key.key, key.params) : 1, mode })),
      ),
  };
}
