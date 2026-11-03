import { useEffect, useRef } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { timelineRef, timeToPx } from "@/modules/timeline";

/** The playhead across the panel's rows, moved from the clock and the scroll without renders. */
export function PanelPlayhead() {
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const x = timeToPx(playback.getTime(), timeline.view.getState().pxPerSecond);
      el.style.transform = `translateX(${x - timeline.scrollLeft()}px)`;
    };
    update();
    const offTime = playback.onTime(update);
    const offScroll = timeline.onScroll(update);
    const offZoom = timeline.view.subscribe(update);
    return () => {
      offTime();
      offScroll();
      offZoom();
    };
  }, [playback, timeline]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-y-0 left-0 z-10 w-0 border-l-2 border-mark will-change-transform"
    />
  );
}
