import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import {
  nextTrackName,
  rowsAbove,
  timelineRef,
  timeToPx,
  trackHeight,
  useHeaderWidth,
  useTimelineScope,
} from "@/modules/timeline";
import { VOICE_TRACK } from "../../logic/record";
import { soundRef } from "../../sound.ref";

/**
 * The take growing on its lane while it's recorded: a light box from where it started, as long as
 * what was recorded so far. A take onto a new Voice track (none was armed) has no lane yet: it's
 * drawn on a dashed lane of its own under the last track, named as the track will be, until it's
 * placed and the track is there. The start and length are written each frame through `style`,
 * only when they changed (rule 24); the lane is found once (again only once it's gone) and
 * measured when the tracks' layout changes. The document changes only once, when the take is
 * placed. Hidden while its lane isn't on the timeline.
 */
export function RecordingTake() {
  const { recorder } = useModule(soundRef);
  const timeline = useModule(timelineRef);
  const project = useModule(projectRef).store;
  const open = useOpenComposition();
  const headerWidth = useHeaderWidth();
  const lanesTop = rowsAbove(useTimelineScope());
  // Drawn until the take is placed, so it never blinks out before its clip is there.
  const recording = useStore(
    recorder.state,
    (s) => s.status === "recording" || s.status === "stopping",
  );
  const trackId = useStore(recorder.state, (s) => s.trackId);
  const at = useStore(recorder.state, (s) => s.at);
  const fresh = recording && trackId === null;
  const name = useStore(project.api, (s) =>
    fresh && open ? nextTrackName(s, open.id, "audio", VOICE_TRACK) : null,
  );
  const ref = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    const content = box?.parentElement;
    if (!recording || !box || !content) return;
    const newLane = laneRef.current;
    let frame = 0;
    let lane: HTMLElement | null = null;
    /** Where the lane is: measured when it's found and when the tracks' layout changes. */
    let place: { top: number; height: number } | null = null;
    let shown = { left: -1, width: -1 };
    const show = (next: { top: number; height: number }) => {
      if (place?.top === next.top && place.height === next.height) return;
      place = next;
      for (const element of [box, newLane]) {
        if (!element) continue;
        element.style.top = `${next.top}px`;
        element.style.height = `${next.height}px`;
        element.style.visibility = "visible";
      }
    };
    /** Under the last lane, where the new Voice track will be. */
    const measureNew = () => {
      const lanes = content.querySelectorAll<HTMLElement>("[data-track-id]");
      const last = lanes[lanes.length - 1];
      const top = last
        ? last.getBoundingClientRect().bottom - content.getBoundingClientRect().top
        : lanesTop;
      show({ top, height: trackHeight("audio") });
    };
    const measure = () => {
      if (trackId === null) return measureNew();
      if (!lane?.isConnected) {
        lane = content.querySelector<HTMLElement>(`[data-track-id="${CSS.escape(trackId)}"]`);
      }
      if (!lane) {
        place = null;
        box.style.visibility = "hidden";
        return;
      }
      show({
        top: lane.getBoundingClientRect().top - content.getBoundingClientRect().top,
        height: lane.offsetHeight,
      });
    };
    const resized = new ResizeObserver(measure);
    resized.observe(content);
    const draw = () => {
      // A new lane follows the tracks above it, which may change while the take records.
      if (trackId === null || !lane?.isConnected) measure();
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
  }, [recording, trackId, at, headerWidth, lanesTop, recorder, timeline.view]);

  if (!recording) return null;
  return (
    <>
      {fresh && (
        <div
          ref={laneRef}
          className="pointer-events-none invisible absolute inset-x-0 top-0 z-[11] border-y border-dashed border-mark bg-mark/5"
        >
          <span
            className="sticky left-0 flex h-full items-center px-2 font-hand text-sm font-bold text-mark"
            style={{ width: headerWidth }}
          >
            {name} · new
          </span>
        </div>
      )}
      <div
        ref={ref}
        className="pointer-events-none invisible absolute left-0 top-0 z-[12] overflow-hidden rounded-xs border border-mark bg-mark/20"
      >
        <span className="px-1 font-hand text-2xs font-bold text-mark">Recording</span>
      </div>
    </>
  );
}
