import { Fragment, useMemo, useRef } from "react";
import { useStore } from "zustand";
import {
  ErrorBoundary,
  MICROS_PER_SECOND,
  useModule,
  usePoint,
  type Micros,
  type TimelineScopeName,
} from "@/core";
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
import { inScope, trackInScope } from "../logic/scope";
import { RULER_HEIGHT, TAIL_SECONDS } from "../timeline.layout";
import { useHeaderWidth } from "./header.width.hook";
import { usePanelScroller } from "./panel.scroller.hook";
import { Playhead } from "./Playhead";
import { TimelineScopeProvider } from "./scope.hook";
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
 *
 * `scope` is what this timeline is for: `"all"` (the default) is the editor's, `"sound"` lists audio
 * tracks only and shows only what modules opted in with `scopes`.
 */
export function TimelinePanel({ scope = "all" }: { scope?: TimelineScopeName }) {
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
  const view = usePanelScroller(scrollRef, scope, headerWidth, pxPerSecond);
  const allOverlays = usePoint(timelineOverlays);
  const allTabs = usePoint(timelineTabs);
  const allMenus = usePoint(timelineMenuItems);
  const allDocks = usePoint(timelineDocks);
  const overlays = useMemo(
    () => allOverlays.filter((o) => inScope(o, scope)),
    [allOverlays, scope],
  );
  const tabs = useMemo(() => allTabs.filter((t) => inScope(t, scope)), [allTabs, scope]);
  const menus = useMemo(() => allMenus.filter((m) => inScope(m, scope)), [allMenus, scope]);
  const docks = useMemo(() => allDocks.filter((d) => inScope(d, scope)), [allDocks, scope]);

  const from: Micros = Math.max(0, pxToTime((view.page - 1) * view.pageWidth, pxPerSecond));
  const to: Micros = pxToTime((view.page + 2) * view.pageWidth, pxPerSecond);
  const contentWidth = Math.max(
    timeToPx(duration + TAIL_SECONDS * MICROS_PER_SECOND, pxPerSecond),
    view.pageWidth,
  );

  const lanes = useMemo(
    () =>
      trackOrder.flatMap((id, index) => {
        const track = tracksById[id];
        if (!track || !trackInScope(track, scope)) return [];
        const visible: Clip[] = [];
        for (const clipId of track.clipIds) {
          const clip = clipsById[clipId];
          if (!clip) continue;
          if (clip.start > to) break; // sorted by start
          if (clip.start + clip.duration >= from) visible.push(clip);
        }
        return [{ track, index, clips: visible }];
      }),
    [trackOrder, tracksById, clipsById, from, to, scope],
  );

  const last = lanes.at(-1);

  return (
    <TimelineScopeProvider value={scope}>
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
              {lanes.map(({ track, index, clips }, position) => (
                <Fragment key={track.id}>
                  <TrackInsert
                    index={index}
                    above={lanes[position - 1]?.track.kind}
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
              {open && last && <TrackInsert index={last.index + 1} above={last.track.kind} />}
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
    </TimelineScopeProvider>
  );
}
