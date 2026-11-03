import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef, timeToPx, useHeaderWidth } from "@/modules/timeline";
import { soundRef } from "../sound.ref";

/**
 * The take growing on its lane while it's recorded: a light box from where it started, as long as
 * what was recorded so far. Its start and length are written each frame through `style`, only
 * when they changed (rule 24); the lane is found once (again only once it's gone) and measured
 * when the tracks' layout changes. The document changes only once, when the take is placed.
 * Hidden while its lane isn't on the timeline.
 */
export function RecordingTake() {
  const { recorder } = useModule(soundRef);
  const timeline = useModule(timelineRef);
  const headerWidth = useHeaderWidth();
  // Drawn until the take is placed, so it never blinks out before its clip is there.
  const recording = useStore(
    recorder.state,
    (s) => s.status === "recording" || s.status === "stopping",
  );
  const trackId = useStore(recorder.state, (s) => s.trackId);
  const at = useStore(recorder.state, (s) => s.at);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    const content = box?.parentElement;
    if (!recording || trackId === null || !box || !content) return;
    let frame = 0;
    let lane: HTMLElement | null = null;
    /** Where the lane is: measured when it's found and when the tracks' layout changes. */
    let place: { top: number; height: number } | null = null;
    let shown = { left: -1, width: -1 };
    const measure = () => {
      if (!lane?.isConnected) {
        lane = content.querySelector<HTMLElement>(`[data-track-id="${CSS.escape(trackId)}"]`);
      }
      if (!lane) {
        place = null;
        box.style.visibility = "hidden";
        return;
      }
      place = {
        top: lane.getBoundingClientRect().top - content.getBoundingClientRect().top,
        height: lane.offsetHeight,
      };
      box.style.top = `${place.top}px`;
      box.style.height = `${place.height}px`;
      box.style.visibility = "visible";
    };
    const resized = new ResizeObserver(measure);
    resized.observe(content);
    const draw = () => {
      if (!lane?.isConnected) measure();
      if (place) {
        // Only what moves is written: the start (zoom) and the length.
        const { pxPerSecond } = timeline.view.getState();
        const left = headerWidth + timeToPx(at, pxPerSecond);
        const width = timeToPx(recorder.length(), pxPerSecond);
        if (left !== shown.left) box.style.transform = `translateX(${left}px)`;
        if (width !== shown.width) box.style.width = `${width}px`;
        shown = { left, width };
      }
      frame = requestAnimationFrame(draw);
    };
    measure();
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
    };
  }, [recording, trackId, at, headerWidth, recorder, timeline.view]);

  if (!recording) return null;
  return (
    <div
      ref={ref}
      className="pointer-events-none invisible absolute left-0 top-0 z-[12] overflow-hidden rounded-xs border border-mark bg-mark/20"
    >
      <span className="px-1 font-hand text-2xs font-bold text-mark">Recording</span>
    </div>
  );
}
