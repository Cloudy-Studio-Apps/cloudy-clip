import type { CompositionId } from "@/modules/project";
import type { PlayheadPlace } from "../preview.types";

/** Nowhere yet: the start, no loop. */
const START: PlayheadPlace = { time: 0, loop: null };

/** Remembers where the playhead was in each composition, and its loop. */
export function rememberPlayheads() {
  const places = new Map<CompositionId, PlayheadPlace>();
  return {
    /** Stores `place` for `from` and returns where the playhead goes in `to`. */
    switchTo(
      from: CompositionId | null,
      to: CompositionId | null,
      place: PlayheadPlace,
    ): PlayheadPlace {
      if (from !== null) places.set(from, place);
      return to === null ? START : (places.get(to) ?? START);
    },
  };
}
