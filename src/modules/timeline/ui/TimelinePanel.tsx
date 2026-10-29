import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { MICROS_PER_SECOND, useKernel, useModule, type Micros } from "@/core";
import { MEDIA_DROP, type MediaDragDetail } from "@/modules/media";
import { projectDuration, type Clip, projectRef } from "@/modules/project";
import { timelineRef } from "../timeline.ref";
import { pxToTime, timeToPx } from "../logic/geometry";
import { addClip } from "../timeline.commands";
import { HEADER_WIDTH, TAIL_SECONDS } from "../timeline.layout";
import { Playhead } from "./Playhead";
import { Ruler } from "./Ruler";
import { TimelineToolbar } from "./TimelineToolbar";
import { TrackHeader } from "./TrackHeader";
import { TrackLane } from "./TrackLane";

/**
 * The timeline panel.
 *
 * Virtualized by pages: the visible area is split into viewport-wide pages and only clips in
 * the current page ± 1 are rendered. Scrolling re-renders only when crossing a page boundary,
 * so long timelines with many clips stay smooth.
 */
export function TimelinePanel() {
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const { bus } = useKernel();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const trackOrder = useStore(project.api, (s) => s.trackOrder);
  const tracksById = useStore(project.api, (s) => s.tracks);
  const clipsById = useStore(project.api, (s) => s.clips);
  const duration = useStore(project.api, projectDuration);
  const [view, setView] = useState({ page: 0, pageWidth: 1200 });

  // Track which page is visible; only page changes cause a render.
  const measure = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const pageWidth = Math.max(200, scroller.clientWidth - HEADER_WIDTH);
    const page = Math.floor(scroller.scrollLeft / pageWidth);
    setView((v) => (v.page === page && v.pageWidth === pageWidth ? v : { page, pageWidth }));
  }, []);

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
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [measure]);

  useEffect(measure, [pxPerSecond, measure]);

  // Ctrl/Cmd + wheel zooms around the pointer.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const before = timeline.view.getState().pxPerSecond;
      const pointerX = e.clientX - scroller.getBoundingClientRect().left - HEADER_WIDTH;
      const anchor = pxToTime(scroller.scrollLeft + pointerX, before);
      timeline.setZoom(before * Math.exp(-e.deltaY * 0.002));
      const after = timeline.view.getState().pxPerSecond;
      scroller.scrollLeft = Math.max(0, timeToPx(anchor, after) - pointerX);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [timeline]);

  // Media dropped below the tracks goes to the default track of its kind.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onDrop = (event: Event) => {
      const { mediaId, clientX } = (event as CustomEvent<MediaDragDetail>).detail;
      const x =
        clientX - scroller.getBoundingClientRect().left - HEADER_WIDTH + scroller.scrollLeft;
      const pps = timeline.view.getState().pxPerSecond;
      void bus.run(addClip, { mediaId, start: Math.max(0, pxToTime(x, pps)) });
    };
    scroller.addEventListener(MEDIA_DROP, onDrop);
    return () => scroller.removeEventListener(MEDIA_DROP, onDrop);
  }, [bus, timeline.view]);

  const from: Micros = Math.max(0, pxToTime((view.page - 1) * view.pageWidth, pxPerSecond));
  const to: Micros = pxToTime((view.page + 2) * view.pageWidth, pxPerSecond);
  const contentWidth = Math.max(
    timeToPx(duration + TAIL_SECONDS * MICROS_PER_SECOND, pxPerSecond),
    view.pageWidth,
  );

  const lanes = useMemo(
    () =>
      trackOrder.flatMap((id) => {
        const track = tracksById[id];
        if (!track) return [];
        const visible: Clip[] = [];
        for (const clipId of track.clipIds) {
          const clip = clipsById[clipId];
          if (!clip) continue;
          if (clip.start > to) break; // sorted by start
          if (clip.start + clip.duration >= from) visible.push(clip);
        }
        return [{ track, clips: visible }];
      }),
    [trackOrder, tracksById, clipsById, from, to],
  );

  return (
    <section className="flex h-full flex-col">
      <TimelineToolbar />
      <div
        ref={scrollRef}
        data-scroll="wide"
        className="relative min-h-0 flex-1 overflow-auto bg-lane"
      >
        <div className="relative" style={{ width: HEADER_WIDTH + contentWidth, minHeight: "100%" }}>
          <Ruler pxPerSecond={pxPerSecond} from={from} to={to} width={contentWidth} />
          {lanes.map(({ track, clips }) => (
            <div key={track.id} className="flex">
              <TrackHeader track={track} />
              <div style={{ width: contentWidth }}>
                <TrackLane
                  track={track}
                  clips={clips}
                  pxPerSecond={pxPerSecond}
                  from={from}
                  to={to}
                  rootRef={scrollRef}
                />
              </div>
            </div>
          ))}
          {duration === 0 && (
            <p
              className="pointer-events-none absolute text-sm text-subtle-foreground"
              style={{ left: HEADER_WIDTH + 16, top: 120 }}
            >
              Drag media from the library onto a track to start editing.
            </p>
          )}
          <Playhead scrollRef={scrollRef} />
        </div>
      </div>
    </section>
  );
}
