import { useModule } from "@/core";
import { timelineRef } from "../timeline.ref";
import { useEffect, useRef } from "react";
import { previewRef } from "@/modules/preview";
import { timeToPx } from "../logic/geometry";
import { HEADER_WIDTH } from "../timeline.layout";

/**
 * The playhead line. Positioned imperatively from the playback clock (no React renders per
 * frame). While playing, the view follows it page by page.
 */
export function Playhead({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const line = ref.current;
      if (!line) return;
      const x = timeToPx(playback.getTime(), timeline.view.getState().pxPerSecond);
      line.style.transform = `translateX(${HEADER_WIDTH + x}px)`;

      const scroller = scrollRef.current;
      if (scroller && playback.isPlaying()) {
        const visible = scroller.clientWidth - HEADER_WIDTH;
        if (x < scroller.scrollLeft || x > scroller.scrollLeft + visible - 40) {
          scroller.scrollLeft = Math.max(0, x - 40);
        }
      }
    };
    const offTime = playback.onTime(update);
    const offZoom = timeline.view.subscribe(update);
    return () => {
      offTime();
      offZoom();
    };
  }, [playback, scrollRef, timeline.view]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-0 left-0 top-0 z-[15] w-px bg-amber-400 will-change-transform"
    />
  );
}
