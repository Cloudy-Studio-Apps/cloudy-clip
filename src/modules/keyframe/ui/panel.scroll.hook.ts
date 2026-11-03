import { useEffect, useState, type RefObject } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef, useHeaderWidth } from "@/modules/timeline";
import { SCROLL_VAR } from "../keyframe.layout";
import type { PanelWindow } from "../keyframe.types";
import { pagesSpan } from "../logic/range";

/** Wheel steps that zoom by this much per pixel of `deltaY` (the timeline's own factor). */
const ZOOM_PER_PIXEL = 0.002;

/**
 * Keeps the panel on the timeline's scroll: sets `--panel-scroll` (px) on the element, which the
 * bands shift by, and forwards the wheel over the panel: sideways or with Shift scrolls the
 * timeline, with Ctrl zooms around the pointer. No renders.
 */
export function usePanelScroll(ref: RefObject<HTMLElement | null>): void {
  const timeline = useModule(timelineRef);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const sync = () => element.style.setProperty(SCROLL_VAR, `${timeline.scrollLeft()}px`);
    sync();
    const offScroll = timeline.onScroll(sync);
    const offZoom = timeline.view.subscribe(sync);
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const before = timeline.view.getState().pxPerSecond;
        timeline.zoomAt(e.clientX, before * Math.exp(-e.deltaY * ZOOM_PER_PIXEL));
      } else if (e.deltaX !== 0 || e.shiftKey) {
        e.preventDefault();
        timeline.setScrollLeft(timeline.scrollLeft() + (e.deltaX !== 0 ? e.deltaX : e.deltaY));
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      offScroll();
      offZoom();
      element.removeEventListener("wheel", onWheel);
    };
  }, [ref, timeline]);
}

/**
 * The scale and the time span the panel draws keys for: the page the view is on and one on each
 * side. It renders only when the view crosses a page or the zoom changes (rule 26).
 */
export function usePanelWindow(ref: RefObject<HTMLElement | null>): PanelWindow {
  const timeline = useModule(timelineRef);
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const headerWidth = useHeaderWidth();
  const [page, setPage] = useState({ page: 0, width: 1200 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const width = Math.max(200, element.clientWidth - headerWidth);
      const next = Math.floor(timeline.scrollLeft() / width);
      setPage((p) => (p.page === next && p.width === width ? p : { page: next, width }));
    };
    measure();
    const offScroll = timeline.onScroll(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      offScroll();
      observer.disconnect();
    };
  }, [ref, timeline, headerWidth, pxPerSecond]);

  const span = pagesSpan(page.page * page.width, page.width, pxPerSecond);
  return { pxPerSecond, ...span };
}
