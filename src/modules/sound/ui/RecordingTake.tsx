import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef, timeToPx, useHeaderWidth } from "@/modules/timeline";
import { soundRef } from "../sound.ref";

/**
 * The take growing on its lane while it's recorded: a light box from where it started, as long as
 * what was recorded so far. Placed every frame through `style` (rule 24); the document changes
 * only once, when the take is placed. Hidden while its lane isn't on the timeline.
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
    if (!recording || trackId === null) return;
    let frame = 0;
    const draw = () => {
      const box = ref.current;
      const content = box?.parentElement;
      const lane = content?.querySelector<HTMLElement>(`[data-track-id="${CSS.escape(trackId)}"]`);
      if (box && content && lane) {
        const { pxPerSecond } = timeline.view.getState();
        const top = lane.getBoundingClientRect().top - content.getBoundingClientRect().top;
        box.style.transform = `translate(${headerWidth + timeToPx(at, pxPerSecond)}px, ${top}px)`;
        box.style.width = `${timeToPx(recorder.length(), pxPerSecond)}px`;
        box.style.height = `${lane.offsetHeight}px`;
        box.style.visibility = "visible";
      } else if (box) box.style.visibility = "hidden";
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
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
