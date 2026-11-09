import { notify, type Logger, type PointReader } from "@/core";
import type { FilterSet } from "./engine/engine.types";
import { frameFilters, pictureFilters } from "./preview.points";
import type { PreviewFilters } from "./preview.types";

/** Sorted by `order`, contribution order among equals. */
const byOrder = <F extends { order: number }>(list: readonly F[]) =>
  [...list].sort((a, b) => a.order - b.order);

/**
 * The filters of one kernel for its engines: the contributions to `pictureFilters` and
 * `frameFilters`, sorted again only when they change, and a filter failing in the live preview
 * told to the user once per kernel.
 */
export function createFilters(points: PointReader, log: Logger): PreviewFilters {
  let picture = points.get(pictureFilters);
  let frame = points.get(frameFilters);
  let set: FilterSet = { picture: byOrder(picture), frame: byOrder(frame) };
  const told = new Set<string>();
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
  };
}
