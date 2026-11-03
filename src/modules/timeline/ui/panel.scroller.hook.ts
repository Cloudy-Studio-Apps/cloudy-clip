import { useCallback, useEffect, useState, type RefObject } from "react";
import { useModule, type TimelineScopeName } from "@/core";
import { MEDIA_DROP, type MediaDragDetail } from "@/modules/media";
import { pxToTime } from "../logic/geometry";
import { timelineRef } from "../timeline.ref";
import type { ScrollerPage } from "../timeline.types";

/**
 * What the timeline panel does with its scrolling element: finds the visible page (only a change
 * of page renders), registers the element with the timeline, zooms on Ctrl/Cmd + wheel around the
 * pointer, and turns media dropped below the tracks into a drop at that time. `headerWidth` is the
 * panel's own, and `scope` is told to the timeline so `zoomAt` uses the same one.
 */
export function usePanelScroller(
  scrollRef: RefObject<HTMLDivElement | null>,
  scope: TimelineScopeName,
  headerWidth: number,
  pxPerSecond: number,
): ScrollerPage {
  const timeline = useModule(timelineRef);
  const [view, setView] = useState<ScrollerPage>({ page: 0, pageWidth: 1200 });

  const measure = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const pageWidth = Math.max(200, scroller.clientWidth - headerWidth);
    const page = Math.floor(scroller.scrollLeft / pageWidth);
    setView((v) => (v.page === page && v.pageWidth === pageWidth ? v : { page, pageWidth }));
  }, [scrollRef, headerWidth]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    measure();
    const detach = timeline.attachScroller(scroller, scope);
    return () => {
      detach();
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [scrollRef, measure, timeline, scope]);

  useEffect(measure, [pxPerSecond, headerWidth, measure]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const before = timeline.view.getState().pxPerSecond;
      timeline.zoomAt(e.clientX, before * Math.exp(-e.deltaY * 0.002));
    };
    const onDrop = (event: Event) => {
      const { item, clientX } = (event as CustomEvent<MediaDragDetail>).detail;
      const x = clientX - scroller.getBoundingClientRect().left - headerWidth + scroller.scrollLeft;
      const pps = timeline.view.getState().pxPerSecond;
      timeline.drop({ item, start: Math.max(0, pxToTime(x, pps)) });
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener(MEDIA_DROP, onDrop);
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener(MEDIA_DROP, onDrop);
    };
  }, [scrollRef, timeline, headerWidth]);

  return view;
}
