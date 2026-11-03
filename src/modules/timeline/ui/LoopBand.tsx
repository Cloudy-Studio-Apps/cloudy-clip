import { useRef, useSyncExternalStore } from "react";
import { useKernel, useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { previewRef, setLoop, type LoopRange } from "@/modules/preview";
import { pxToTime, timeToPx } from "../logic/geometry";
import { SNAP_PX } from "../timeline.layout";
import { startLoopDrag } from "./loop.gesture";
import { useSnapCandidates } from "./snap.hook";

/**
 * The loop region on the ruler: a tinted band with a handle at each end. Dragging a handle moves
 * that end (snapping as the ruler scrub does; Ctrl or Cmd moves it freely), one `preview.setLoop`
 * on release, Escape cancels; double-clicking one clears the loop. Nothing while there is no loop.
 */
export function LoopBand({ pxPerSecond }: { pxPerSecond: number }) {
  const { bus } = useKernel();
  const { playback } = useModule(previewRef);
  const project = useModule(projectRef).store;
  const compositionId = useOpenComposition()?.id;
  const snapCandidates = useSnapCandidates();
  const loop = useSyncExternalStore(playback.onLoopChange, playback.getLoop);
  const band = useRef<HTMLDivElement>(null);
  if (!loop) return null;

  const place = ({ from, to }: LoopRange) => {
    if (!band.current) return;
    band.current.style.left = `${timeToPx(from, pxPerSecond)}px`;
    band.current.style.width = `${timeToPx(to - from, pxPerSecond)}px`;
  };

  const handle = (edge: keyof LoopRange) => (
    <button
      type="button"
      title="Drag to move this end of the loop; double-click to clear the loop"
      aria-label={edge === "from" ? "Loop start" : "Loop end"}
      className={`pointer-events-auto absolute bottom-0 h-3 w-2 cursor-ew-resize rounded-t-xs bg-on ${
        edge === "from" ? "-left-1" : "-right-1"
      }`}
      onDoubleClick={() => void bus.run(setLoop, { range: null })}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // The ruler under the handle would scrub.
        event.stopPropagation();
        const candidates = compositionId
          ? snapCandidates(project.getState(), compositionId, playback.getTime())
          : [];
        startLoopDrag({
          down: event.nativeEvent,
          loop,
          edge,
          candidates,
          threshold: pxToTime(SNAP_PX, pxPerSecond),
          timeAtDelta: (px) => pxToTime(px, pxPerSecond),
          place,
          // Refused (under a frame) or clamped, the band goes where the clock has the loop.
          commit: (range) =>
            void bus.run(setLoop, { range }).then(() => place(playback.getLoop() ?? loop)),
        });
      }}
    />
  );

  return (
    <div
      ref={band}
      className="pointer-events-none absolute inset-y-0 z-[5] border-x border-on bg-on/15"
      style={{
        left: timeToPx(loop.from, pxPerSecond),
        width: timeToPx(loop.to - loop.from, pxPerSecond),
      }}
    >
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-on" />
      {handle("from")}
      {handle("to")}
    </div>
  );
}
