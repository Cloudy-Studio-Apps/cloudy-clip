import { notify, type Logger, type PointReader } from "@/core";
import type { FilterSet } from "./engine/engine.types";
import { frameFilters, pictureFilters } from "./preview.points";
import type { PreviewFilters } from "./preview.types";

/** Sorted by `order`, contribution order among equals. */
const byOrder = <F extends { order: number }>(list: readonly F[]) =>
  [...list].sort((a, b) => a.order - b.order);

/**
 * The filters of one kernel for its engines: the contributions to `pictureFilters` and
 * `frameFilters`, sorted again only when they change, and a filter (or a mask's GPU part) failing
 * in the live preview, or a transition drawing without the GPU there, told to the user once per
 * kernel.
 */
export function createFilters(points: PointReader, log: Logger): PreviewFilters {
  let picture = points.get(pictureFilters);
  let frame = points.get(frameFilters);
  let set: FilterSet = { picture: byOrder(picture), frame: byOrder(frame) };
  const told = new Set<string>();
  let maskTold = false;
  let mixTold = false;
  /** Sorts again when a contribution came or went; whether one did. */
  function refresh(): boolean {
    const nextPicture = points.get(pictureFilters);
    const nextFrame = points.get(frameFilters);
    if (nextPicture === picture && nextFrame === frame) return false;
    picture = nextPicture;
    frame = nextFrame;
    set = { picture: byOrder(picture), frame: byOrder(frame) };
    return true;
  }
  return {
    current() {
      refresh();
      return set;
    },
    onChange(listener) {
      return points.subscribe(() => {
        if (refresh()) listener();
      });
    },
    failed(id, error) {
      if (told.has(id)) return;
      told.add(id);
      log.warn(`Filter ${id} failed in the preview`, error);
      const reason = error instanceof Error ? error.message : String(error);
      notify("error", `The preview shows the picture without ${id}, which failed: ${reason}`);
    },
    maskFailed(error) {
      if (maskTold) return;
      maskTold = true;
      log.warn("Mask feather or luma matte failed in the preview", error);
      notify("info", "Soft mask edges need the graphics card; masks show hard edges for now.");
    },
    mixWithoutGpu() {
      if (mixTold) return;
      mixTold = true;
      log.warn("A transition drew without the GPU in the preview (no WebGL2)");
      notify("info", "Some transitions need the graphics card; they show without blur for now.");
    },
  };
}
