import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule, type Micros } from "@/core";
import { frameDuration, useOpenComposition } from "@/modules/project";
import { RULER_HEIGHT, timelineRef, timeToPx, useHeaderWidth } from "@/modules/timeline";
import { setSettings } from "../composition.commands";
import { startEndDrag } from "./end.gesture";

/** Where the open composition ends: a line with a handle in the ruler, and everything past it dimmed. */
export function EndMarker() {
  const { bus } = useKernel();
  const timeline = useModule(timelineRef);
  const composition = useOpenComposition();
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const headerWidth = useHeaderWidth();
  const line = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const duration = composition?.duration;

  const place = useCallback(
    (time: Micros) => {
      const left = `${headerWidth + timeToPx(time, pxPerSecond)}px`;
      if (line.current) line.current.style.left = left;
      if (dim.current) dim.current.style.left = left;
    },
    [pxPerSecond, headerWidth],
  );

  useEffect(() => {
    if (duration !== undefined) place(duration);
  }, [duration, place]);

  if (!composition) return null;
  const { id } = composition;

  return (
    <>
      <div
        ref={dim}
        className="pointer-events-none absolute inset-y-0 right-0 z-[12] bg-black/40"
      />
      {/* The line takes no pointer: it sits on the last clip's edge, where drops and trims aim. */}
      <div
        ref={line}
        className="pointer-events-none absolute inset-y-0 z-[35] w-px -translate-x-1/2 bg-primary"
      >
        <div
          title="End of the composition. Drag to change its length."
          className="pointer-events-auto sticky top-0 -ml-1 w-2.5 cursor-ew-resize rounded-b-xs bg-primary"
          style={{ height: RULER_HEIGHT }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            startEndDrag(
              event.nativeEvent,
              composition.duration,
              frameDuration(composition.format),
              (px) => Math.round((px / pxPerSecond) * 1_000_000),
              place,
              (time) =>
                void bus.run(setSettings, {
                  compositionId: id,
                  duration: time,
                  extendToFit: false,
                }),
            );
          }}
        />
      </div>
    </>
  );
}
