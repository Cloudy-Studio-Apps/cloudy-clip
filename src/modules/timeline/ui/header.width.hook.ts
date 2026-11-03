import { useStore } from "zustand";
import { useModule } from "@/core";
import { headerWidthFor } from "../logic/scope";
import { timelineRef } from "../timeline.ref";
import { useTimelineScope } from "./scope.hook";

/**
 * Width of the track header column in px: where time 0 starts in the timeline's content. It is
 * `HEADER_WIDTH` unless a module changed it with `setHeaderWidth`. A sound-scope timeline has a
 * width of its own, which never touches the one Edit uses.
 */
export function useHeaderWidth(): number {
  const scope = useTimelineScope();
  const shared = useStore(useModule(timelineRef).view, (s) => s.headerWidth);
  return headerWidthFor(scope, shared);
}
