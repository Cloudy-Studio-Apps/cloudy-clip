import type { Micros } from "@/core";
import type { CaptureOptions } from "@/modules/preview";
import { shrinkDataUrl } from "@/ui";
import { TINT_CUT, TINT_WITH } from "./tint.filter";
import type { TintApi } from "./tint.types";

/** Pictures kept for look cards: a few looks, a few stills, a few frames. */
const KEPT = 64;
const LOOK_WIDTH = 160;

/**
 * Layer and look thumbnails: a capture of one clip with its grade cut at a node, or drawn as
 * another grade, asked through that capture's own filter option (nothing shared, so no other
 * capture sees it). Captures run one at a time, to keep the load down. A look thumbnail is kept by
 * clip, time and grade, so asking again for the same one draws nothing. One per kernel.
 */
export function createThumbs(
  capture: (time: Micros, compositionId: string, options: CaptureOptions) => Promise<string>,
): Pick<TintApi, "thumb" | "lookThumb"> {
  let queue: Promise<unknown> = Promise.resolve();
  const queued = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  };
  const kept = new Map<string, Promise<string>>();
  return {
    thumb: (clipId, nodeId, time, compositionId) =>
      queued(() => capture(time, compositionId, { only: clipId, filters: { [TINT_CUT]: nodeId } })),
    lookThumb(clipId, grade, time, compositionId) {
      const key = JSON.stringify([clipId, time, compositionId, grade]);
      const known = kept.get(key);
      if (known) return known;
      const made = queued(async () =>
        shrinkDataUrl(
          await capture(time, compositionId, { only: clipId, filters: { [TINT_WITH]: grade } }),
          LOOK_WIDTH,
          0.8,
        ),
      );
      kept.set(key, made);
      made.catch(() => kept.delete(key));
      if (kept.size > KEPT) kept.delete(kept.keys().next().value as string);
      return made;
    },
  };
}
