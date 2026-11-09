import type { Micros } from "@/core";
import type { CaptureOptions } from "@/modules/preview";
import type { ClipId, CompositionId, GradeNodeId } from "@/modules/project";
import type { TintApi, TintCuts } from "./tint.types";

/**
 * Layer thumbnails: a capture of one clip with its grade cut at a node. The cut is set only for
 * the length of the capture, and captures run one at a time so two cuts never meet. One per kernel.
 */
export function createThumbs(
  capture: (time: Micros, compositionId: CompositionId, options: CaptureOptions) => Promise<string>,
): { cuts: TintCuts; thumb: TintApi["thumb"] } {
  const cuts: TintCuts = new Map();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    cuts,
    thumb(clipId: ClipId, nodeId: GradeNodeId, time, compositionId) {
      const run = async () => {
        cuts.set(clipId, nodeId);
        try {
          return await capture(time, compositionId, { only: clipId });
        } finally {
          cuts.delete(clipId);
        }
      };
      const result = queue.then(run, run);
      queue = result.catch(() => {});
      return result;
    },
  };
}
