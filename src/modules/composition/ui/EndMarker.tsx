import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule, type Micros } from "@/core";
import { useOpenComposition } from "@/modules/project";
import { HEADER_WIDTH, timelineRef, timeToPx } from "@/modules/timeline";
import { setSettings } from "../composition.commands";
import { startEndDrag } from "./end.gesture";

/** Where the open composition ends: a draggable marker, and everything past it dimmed. */
export function EndMarker() {
  const { bus } = useKernel();
  const timeline = useModule(timelineRef);
  const composition = useOpenComposition();
  const pxPerSecond = useStore(timeline.view, (s) => s.pxPerSecond);
  const line = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const duration = composition?.duration;

  const place = useCallback(
    (time: Micros) => {
      const left = `${HEADER_WIDTH + timeToPx(time, pxPerSecond)}px`;
      if (line.current) line.current.style.left = left;
      if (dim.current) dim.current.style.left = left;
    },
    [pxPerSecond],
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
      <div
        ref={line}
        title="End of the composition. Drag to change its length."
        className="absolute inset-y-0 z-[13] w-1.5 -translate-x-1/2 cursor-ew-resize border-x-2 border-x-transparent bg-primary bg-clip-padding"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          startEndDrag(
            event.nativeEvent,
            composition.duration,
            (px) => Math.round((px / pxPerSecond) * 1_000_000),
            place,
            (time) =>
              void bus.run(setSettings, { compositionId: id, duration: time, extendToFit: false }),
          );
        }}
      />
    </>
  );
}
