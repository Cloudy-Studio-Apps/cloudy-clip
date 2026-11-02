import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { ErrorBoundary, MICROS_PER_SECOND, useModule, usePoint, type Micros } from "@/core";
import { MEDIA_DROP, type MediaDragDetail } from "@/modules/media";
import { cn, ContextMenu } from "@/ui";
import {
  compositionContent,
  projectRef,
  useOpenComposition,
  type Clip,
  type TrackId,
} from "@/modules/project";
import {
  timelineDocks,
  timelineMenuItems,
  timelineOverlays,
  timelineTabs,
} from "../timeline.points";
import { timelineRef } from "../timeline.ref";
import { pxToTime, timeToPx } from "../logic/geometry";
import { RULER_HEIGHT, TAIL_SECONDS } from "../timeline.layout";
import { useHeaderWidth } from "./header.width.hook";
import { Playhead } from "./Playhead";
import { Ruler } from "./Ruler";
import { TimelineToolbar } from "./TimelineToolbar";
import { TrackHeader } from "./TrackHeader";
import { TrackInsert } from "./TrackInsert";
import { TrackLane } from "./TrackLane";

/** Room kept under the ruler for the horizontal scrollbar when the tracks are folded away. */
const SCROLLBAR_HEIGHT = 12;

const NO_TRACKS: readonly TrackId[] = [];

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const headerWidth = useHeaderWidth();
  const tracksHidden = useStore(timeline.view, (s) => s.tracksHidden);
  const open = useOpenComposition();
  const trackOrder = open?.trackOrder ?? NO_TRACKS;
  const tracksById = useStore(project.api, (s) => s.tracks);
  const clipsById = useStore(project.api, (s) => s.clips);
  const content = useStore(project.api, (s) => (open ? compositionContent(s, open.id) : 0));
  const duration = Math.max(open?.duration ?? 0, content);
  const [view, setView] = useState({ page: 0, pageWidth: 1200 });
  const overlays = usePoint(timelineOverlays);
  const tabs = usePoint(timelineTabs);
  const menus = usePoint(timelineMenuItems);
  const docks = usePoint(timelineDocks);

  // Track which page is visible; only page changes cause a render.
  const measure = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const pageWidth = Math.max(200, scroller.clientWidth - timeline.view.getState().headerWidth);
    const page = Math.floor(scroller.scrollLeft / pageWidth);
    setView((v) => (v.page === page && v.pageWidth === pageWidth ? v : { page, pageWidth }));
  }, [timeline]);

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
    const detach = timeline.attachScroller(scroller);
    return () => {
      detach();
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [measure, timeline]);

  useEffect(measure, [pxPerSecond, headerWidth, measure]);

  // Ctrl/Cmd + wheel zooms around the pointer.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const before = timeline.view.getState().pxPerSecond;
      timeline.zoomAt(e.clientX, before * Math.exp(-e.deltaY * 0.002));
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [timeline]);

  // Media dropped below the tracks goes to the default track of its kind.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onDrop = (event: Event) => {
      const { item, clientX } = (event as CustomEvent<MediaDragDetail>).detail;
      const x =
        clientX -
        scroller.getBoundingClientRect().left -
        timeline.view.getState().headerWidth +
        scroller.scrollLeft;
      const pps = timeline.view.getState().pxPerSecond;
      timeline.drop({ item, start: Math.max(0, pxToTime(x, pps)) });
    };
    scroller.addEventListener(MEDIA_DROP, onDrop);
    return () => scroller.removeEventListener(MEDIA_DROP, onDrop);
  }, [timeline]);

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
      {tabs.map(({ id, component: Tabs }) => (
        <ErrorBoundary key={id} name={id}>
          <Tabs />
        </ErrorBoundary>
      ))}
      <ContextMenu
        items={({ clientX, clientY }) => {
          const at = timeline.dropTarget(clientX, clientY);
          return menus.flatMap((menu) => menu.items(at));
        }}
      >
        <div
          ref={scrollRef}
          data-scroll="wide"
          className={cn(
            "relative bg-lane",
            tracksHidden ? "overflow-x-auto overflow-y-hidden" : "min-h-0 flex-1 overflow-auto",
          )}
          style={tracksHidden ? { height: RULER_HEIGHT + SCROLLBAR_HEIGHT } : undefined}
        >
          <div
            className="relative"
            style={{ width: headerWidth + contentWidth, minHeight: "100%" }}
          >
            <Ruler pxPerSecond={pxPerSecond} from={from} to={to} width={contentWidth} />
            {lanes.map(({ track, clips }, index) => (
              <Fragment key={track.id}>
                <TrackInsert
                  index={index}
                  above={lanes[index - 1]?.track.kind}
                  below={track.kind}
                />
                <div className="flex">
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
              </Fragment>
            ))}
            {open && lanes.length > 0 && (
              <TrackInsert index={lanes.length} above={lanes.at(-1)?.track.kind} />
            )}
            {open && content === 0 && (
              <p
                className="pointer-events-none absolute text-sm text-subtle-foreground"
                style={{ left: headerWidth + 16, top: 120 }}
              >
                Drag media from the library onto a track to start editing.
              </p>
            )}
            <Playhead scrollRef={scrollRef} />
            {overlays.map(({ id, component: Overlay }) => (
              <ErrorBoundary key={id} name={id}>
                <Overlay />
              </ErrorBoundary>
            ))}
          </div>
        </div>
      </ContextMenu>
      {docks.map(({ id, component: Dock }) => (
        <ErrorBoundary key={id} name={id}>
          <Dock />
        </ErrorBoundary>
      ))}
    </section>
  );
}
