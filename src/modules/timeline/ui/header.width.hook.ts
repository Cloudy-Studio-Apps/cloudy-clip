import { useStore } from "zustand";
import { useModule, type TimelineScopeName } from "@/core";
import { headerWidthFor } from "../logic/scope";
import { timelineRef } from "../timeline.ref";
import { useTimelineScope } from "./scope.hook";

/**
 * Width of the track header column in px: where time 0 starts in the timeline's content. It is
 * `HEADER_WIDTH` unless a module changed it with `setHeaderWidth`. A sound-scope timeline has a
 * base width of its own (see `headerWidthFor`). It reads the scope of the panel it sits in;
 * the panel itself, which sits above its own scope provider, passes its `scope`.
 */
export function useHeaderWidth(scope?: TimelineScopeName): number {
  const inherited = useTimelineScope();
  const shared = useStore(useModule(timelineRef).view, (s) => s.headerWidth);
  return headerWidthFor(scope ?? inherited, shared);
}
