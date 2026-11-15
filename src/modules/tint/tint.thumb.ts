import type { Micros } from "@/core";
import type { ClipGrade } from "@/modules/project";
import type { CaptureOptions } from "@/modules/preview";
import { shrinkDataUrl } from "@/ui";
import { TINT_CUT, TINT_WITH } from "./tint.filter";
import type { TintApi, TintCut, TintWith } from "./tint.types";

/** Pictures kept for look cards: a few looks, a few stills, a few frames. */
const KEPT = 64;
const LOOK_WIDTH = 160;

/**
 * Layer and look thumbnails: a capture of one clip alone (at every level, the whole timeline's
 * too) with the grade of a level cut at a node, or drawn as another grade (`TintCut`, `TintWith`), asked through that capture's own filter option (nothing shared, so no other
 * capture sees it). Captures run one at a time, to keep the load down. A look thumbnail is kept by
 * clip (its signature), time and grade, so asking again for the same one draws nothing. One per kernel.
 */
export function createThumbs(
  capture: (time: Micros, compositionId: string, options: CaptureOptions) => Promise<string>,
  loading: (grade: ClipGrade) => boolean,
): Pick<TintApi, "thumb" | "lookThumb"> {
  let queue: Promise<unknown> = Promise.resolve();
  const queued = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run, run);
    queue = result.catch(() => {});
    return result;
  };
  const kept = new Map<string, Promise<string>>();
  return {
    thumb: (clipId, nodeId, time, compositionId, level = "clip") =>
      queued(() =>
        capture(time, compositionId, {
          only: clipId,
          filters: { [TINT_CUT]: { level, node: nodeId } satisfies TintCut },
        }),
      ),
    lookThumb(clipId, signature, grade, time, compositionId, level = "clip") {
      const key = JSON.stringify([clipId, signature, time, compositionId, level, grade]);
      const known = kept.get(key);
      if (known) return known;
      const made = queued(async () =>
        shrinkDataUrl(
          await capture(time, compositionId, {
            only: clipId,
            filters: { [TINT_WITH]: { level, grade } satisfies TintWith },
          }),
          LOOK_WIDTH,
          0.8,
        ),
      );
      kept.set(key, made);
      // A picture drawn while a LUT was still loading leaves it out: not kept.
      made.then(
        () => loading(grade) && kept.delete(key),
        () => kept.delete(key),
      );
      if (kept.size > KEPT) kept.delete(kept.keys().next().value as string);
      return made;
    },
  };
}
