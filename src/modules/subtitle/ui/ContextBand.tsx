import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import {
  CONTEXT_HEIGHT,
  PlayheadHead,
  RULER_HEIGHT,
  rowsAbove,
  timeToPx,
  timelineRef,
  useHeaderWidth,
  useScrubDrag,
} from "@/modules/timeline";
import { pictureCuts, pictureSpans } from "../logic/context";
import { SoundRow } from "./SoundRow";
import { useTimelineWindow } from "./timeline.window.hook";

const ROW = CONTEXT_HEIGHT / 2;

/**
 * The Subtitles page's timing context, sticky under the ruler of its timeline: a faded Picture row
 * (the stretches between cuts) and Sound row (the mixed waveform), which a press only scrubs, and
 * the cuts as faint dashed lines through the cue lanes. Only what is near the view is drawn.
 */
export function ContextBand() {
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const headerWidth = useHeaderWidth();
  const scrub = useScrubDrag();
  const ref = useRef<HTMLDivElement>(null);
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const { from, to } = useTimelineWindow(ref, pxPerSecond);
  const id = useOpenComposition()?.id;
  const clips = useStore(project.api, (s) => s.clips);
  const tracks = useStore(project.api, (s) => s.tracks);
  // Clips and tracks are what the cuts are made of: work them out again when either changes.
  const { spans, cuts } = useMemo(() => {
    const state = { ...project.getState(), clips, tracks };
    return id
      ? { spans: pictureSpans(state, id), cuts: pictureCuts(state, id) }
      : { spans: [], cuts: [] };
  }, [project, clips, tracks, id]);
  const x = (time: number) => timeToPx(time, pxPerSecond);
  const inView = (start: number, end: number) => end >= from && start <= to;

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0">
      {cuts.map(
        (cut) =>
          inView(cut, cut) && (
            <i
              key={cut}
              className="absolute bottom-0 w-0 border-l border-dashed border-subtle-foreground opacity-40"
              style={{ left: headerWidth + x(cut), top: rowsAbove("subtitle") }}
            />
          ),
      )}
      <div
        className="sticky z-30 flex"
        style={{ top: RULER_HEIGHT, marginTop: RULER_HEIGHT, height: CONTEXT_HEIGHT }}
      >
        <div
          className="sticky left-0 z-40 flex shrink-0 flex-col border-b border-r-[1.5px] border-b-border border-r-subtle-foreground bg-muted font-mono text-2xs text-subtle-foreground"
          style={{ width: headerWidth }}
        >
          <span className="flex flex-1 items-center border-b border-border px-2.5">Picture</span>
          <span className="flex flex-1 items-center px-2.5">Sound</span>
        </div>
        <div
          title="For timing only: press to move the playhead"
          className="pointer-events-auto relative min-w-0 flex-1 cursor-col-resize border-b border-border bg-surface"
          onPointerDown={(e) => {
            if (e.button === 0) scrub(e.nativeEvent, e.currentTarget);
          }}
        >
          <div className="relative border-b border-border opacity-50" style={{ height: ROW }}>
            {spans.map(
              (span) =>
                inView(span.start, span.end) && (
                  <i
                    key={span.start}
                    className="absolute inset-y-[3px] rounded-xs bg-muted shadow-[inset_0_0_0_1px_var(--border-strong)]"
                    style={{ left: x(span.start), width: x(span.end) - x(span.start) }}
                  />
                ),
            )}
          </div>
          <div className="opacity-50" style={{ height: ROW }}>
            <SoundRow headerWidth={headerWidth} height={ROW - 1} />
          </div>
          <PlayheadHead bare />
        </div>
      </div>
    </div>
  );
}
