import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef } from "../timeline.ref";

/**
 * Width of the track header column in px: where time 0 starts in the timeline's content. It is
 * `HEADER_WIDTH` unless a module changed it with `setHeaderWidth`.
 */
export function useHeaderWidth(): number {
  return useStore(useModule(timelineRef).view, (s) => s.headerWidth);
}
