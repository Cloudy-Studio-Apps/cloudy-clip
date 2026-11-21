import { useEffect, useState, type RefObject } from "react";
import type { Micros } from "@/core";
import { pxToTime, TIMELINE_SCROLLER } from "@/modules/timeline";

/**
 * The times worth drawing in the timeline panel `ref` sits in: the viewport-wide page in view and
 * one each side, as the panel itself renders. Re-renders only when the page changes.
 */
export function useTimelineWindow(
  ref: RefObject<HTMLElement | null>,
  pxPerSecond: number,
): { from: Micros; to: Micros } {
  const [page, setPage] = useState({ index: 0, width: 2000 });

  useEffect(() => {
    const scroller = ref.current?.closest<HTMLElement>(TIMELINE_SCROLLER);
    if (!scroller) return;
    const update = () => {
      const width = Math.max(1, scroller.clientWidth);
      const index = Math.floor(scroller.scrollLeft / width);
      setPage((p) => (p.index === index && p.width === width ? p : { index, width }));
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      resize.disconnect();
    };
  }, [ref]);

  return {
    from: pxToTime(Math.max(0, (page.index - 1) * page.width), pxPerSecond),
    to: pxToTime((page.index + 2) * page.width, pxPerSecond),
  };
}
