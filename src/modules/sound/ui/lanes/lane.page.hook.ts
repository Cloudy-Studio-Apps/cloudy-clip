import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import {
  TIMELINE_CONTENT,
  TIMELINE_SCROLLER,
  timelineRef,
  useHeaderWidth,
} from "@/modules/timeline";

/**
 * What an overlay of volume-line lanes needs: its root (to find the timeline's content), the
 * stretch to draw in px of the timeline (the viewport and the one either side of it, again when
 * the scroll reaches another viewport, so a long line costs what a screen of it does), the zoom,
 * the header width, and a counter that changes when the content resizes (lanes measure again).
 */
export function useLanePage() {
  const headerWidth = useHeaderWidth();
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const root = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState({ index: 0, width: 1 });
  const [layout, setLayout] = useState(0);

  useEffect(() => {
    const content = root.current?.closest<HTMLElement>(TIMELINE_CONTENT);
    const scroller = content?.closest<HTMLElement>(TIMELINE_SCROLLER);
    if (!content || !scroller) return;
    const update = () => {
      const width = Math.max(1, scroller.clientWidth - headerWidth);
      const index = Math.floor(scroller.scrollLeft / width);
      setPage((p) => (p.index === index && p.width === width ? p : { index, width }));
    };
    const resized = new ResizeObserver(() => {
      update();
      setLayout((n) => n + 1);
    });
    resized.observe(content);
    resized.observe(scroller);
    scroller.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      resized.disconnect();
      scroller.removeEventListener("scroll", update);
    };
  }, [headerWidth]);

  return {
    root,
    headerWidth,
    pxPerSecond,
    layout,
    from: Math.max(0, (page.index - 1) * page.width),
    to: (page.index + 2) * page.width,
  };
}
