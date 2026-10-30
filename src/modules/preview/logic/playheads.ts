import type { Micros } from "@/core";
import type { CompositionId } from "@/modules/project";

/** Remembers where the playhead was in each composition. */
export function rememberPlayheads() {
  const times = new Map<CompositionId, Micros>();
  return {
    /** Stores `time` for `from` and returns where the playhead goes in `to`. */
    switchTo(from: CompositionId | null, to: CompositionId | null, time: Micros): Micros {
      if (from !== null) times.set(from, time);
      return to === null ? 0 : (times.get(to) ?? 0);
    },
  };
}
