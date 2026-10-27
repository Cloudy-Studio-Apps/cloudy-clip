import { useEffect, type RefObject } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { timeToPx } from "../logic/geometry";
import { timelineRef } from "../timeline.ref";

/**
 * Keeps an element at the playhead's x (plus `offset` px), imperatively, so playback causes no
 * React renders. `onMove` runs after each move with the playhead's x in content pixels.
 */
export function usePlayheadX(
  ref: RefObject<HTMLElement | null>,
  offset: number,
  onMove?: (x: number) => void,
): void {
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);

  useEffect(() => {
    const update = () => {
      const element = ref.current;
      if (!element) return;
      const x = timeToPx(playback.getTime(), timeline.view.getState().pxPerSecond);
      element.style.transform = `translateX(${offset + x}px)`;
      onMove?.(x);
    };
    update();
    const offTime = playback.onTime(update);
    const offZoom = timeline.view.subscribe(update);
    return () => {
      offTime();
      offZoom();
    };
  }, [playback, timeline.view, ref, offset, onMove]);
}
