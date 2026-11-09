import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import {
  TIMELINE_CONTENT,
  TIMELINE_SCROLLER,
  timelineRef,
  useHeaderWidth,
  useTimelineScope,
} from "@/modules/timeline";
import { soundRef } from "../../sound.ref";
import { TrackLineLane } from "./TrackLineLane";

/**
 * The volume lines of the open composition's audio tracks (`timelineOverlays`, both pages), each
 * over its lane: faint and dashed behind the clips' lines, solid and editable when in front (L on
 * the header). With Draw volume on the Sound page, every audio lane takes strokes. Drawn for the
 * viewport and the one either side of it only, again when the scroll reaches another viewport, so
 * a long line costs what a screen of it does.
 */
export function TrackVolumeLine() {
  const project = useModule(projectRef).store;
  const sound = useModule(soundRef);
  const open = useOpenComposition();
  const scope = useTimelineScope();
  const headerWidth = useHeaderWidth();
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const tracks = useStore(project.api, (s) => s.tracks);
  const drawing = useStore(sound.view, (s) => s.tool === "draw") && scope === "sound";
  const lineView = useStore(sound.view, (s) => s.lineView);
  const audio = useMemo(
    () =>
      Object.values(tracks).filter(
        (track) => track.kind === "audio" && track.compositionId === open?.id,
      ),
    [tracks, open?.id],
  );
  const root = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState({ index: 0, width: 1 });
  // Lanes move when the content resizes: each lane measures again.
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

  const from = Math.max(0, (page.index - 1) * page.width);
  const to = (page.index + 2) * page.width;
  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[11]">
      {audio.map((track) => {
        // In front only where L is: the Sound page. Edit draws every line behind.
        const inFront = scope === "sound" && (lineView[track.id] ?? false);
        if (!track.mix?.volumeLine && !inFront && !drawing) return null;
        return (
          <TrackLineLane
            key={track.id}
            track={track}
            inFront={inFront}
            drawing={drawing}
            headerWidth={headerWidth}
            pxPerSecond={pxPerSecond}
            from={from}
            to={to}
            layout={layout}
          />
        );
      })}
    </div>
  );
}
