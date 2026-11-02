import { useCallback, useRef } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { HEADER_WIDTH } from "../timeline.layout";
import { usePlayheadX } from "./playhead.hook";

/**
 * The playhead line across the lanes (its head is drawn by the ruler). Positioned from the
 * playback clock without React renders. While playing, the view follows it page by page.
 */
export function Playhead({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const { playback } = useModule(previewRef);
  const ref = useRef<HTMLDivElement>(null);

  const follow = useCallback(
    (x: number) => {
      const scroller = scrollRef.current;
      if (!scroller || !playback.isPlaying()) return;
      const visible = scroller.clientWidth - HEADER_WIDTH;
      if (x < scroller.scrollLeft || x > scroller.scrollLeft + visible - 40) {
        scroller.scrollLeft = Math.max(0, x - 40);
      }
    },
    [playback, scrollRef],
  );
  usePlayheadX(ref, HEADER_WIDTH, follow);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute bottom-0 left-0 top-0 z-[15] w-0 border-l-2 border-mark will-change-transform"
    />
  );
}

/** The playhead's head, on the ruler. */
export function PlayheadHead() {
  const ref = useRef<HTMLElement>(null);
  usePlayheadX(ref, 0);
  return (
    <i
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 z-10 h-full w-0 border-l-2 border-mark will-change-transform"
    >
      <b className="absolute -left-[7px] top-0 h-[15px] w-[13px] bg-mark [clip-path:polygon(0_0,100%_0,100%_55%,50%_100%,0_55%)]" />
    </i>
  );
}
