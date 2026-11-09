import type { Micros } from "@/core";
import type { CaptureOptions } from "@/modules/preview";
import { TINT_CUT } from "./tint.filter";
import type { TintApi } from "./tint.types";

/**
 * Layer thumbnails: a capture of one clip with its grade cut at a node, asked through that
 * capture's own filter option (nothing shared, so no other capture sees the cut). Captures run one
 * at a time, to keep the load down. One per kernel.
 */
export function createThumbs(
  capture: (time: Micros, compositionId: string, options: CaptureOptions) => Promise<string>,
): { thumb: TintApi["thumb"] } {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    thumb(clipId, nodeId, time, compositionId) {
      const run = () =>
        capture(time, compositionId, { only: clipId, filters: { [TINT_CUT]: nodeId } });
      const result = queue.then(run, run);
      queue = result.catch(() => {});
      return result;
    },
  };
}
