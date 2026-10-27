import { memo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { mediaRef } from "@/modules/media";
import { type Clip, type TrackKind, projectRef } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { timelineRef } from "../timeline.ref";
import { timeToPx } from "../logic/geometry";
import { gestureMode, startClipGesture } from "./clip-gesture";

interface TimelineClipProps {
  clip: Clip;
  kind: TrackKind;
  pxPerSecond: number;
  /** The scroll root, used to find lanes during a drag. */
  rootRef: React.RefObject<HTMLDivElement | null>;
}

/** One clip on a lane. Drag the body to move it, the edges to trim it. */
export const TimelineClip = memo(function TimelineClip({
  clip,
  kind,
  pxPerSecond,
  rootRef,
}: TimelineClipProps) {
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const { playback } = useModule(previewRef);
  const media = useModule(mediaRef);
  const { bus } = useKernel();
  const ref = useRef<HTMLDivElement>(null);
  const selected = useStore(timeline.view, (s) => s.selection.includes(clip.id));
  const name = useStore(project.api, (s) => s.media[clip.mediaId]?.name ?? "Missing media");
  const poster = useStore(media.probes, (s) => s.probes[clip.mediaId]?.posterUrl);

  return (
    <div
      ref={ref}
      data-clip-id={clip.id}
      className={`group absolute bottom-1 top-1 overflow-hidden rounded-md border text-[11px] text-white select-none data-[invalid=true]:!border-red-500 data-[invalid=true]:!bg-red-900/80 ${
        kind === "video" ? "border-sky-700 bg-sky-900/80" : "border-emerald-700 bg-emerald-900/80"
      } ${selected ? "ring-2 ring-amber-400" : ""}`}
      style={{
        left: timeToPx(clip.start, pxPerSecond),
        width: timeToPx(clip.duration, pxPerSecond),
      }}
      onPointerMove={(e) => {
        // Show the right cursor for move vs. trim.
        const mode = gestureMode(e.nativeEvent.offsetX, e.currentTarget.offsetWidth);
        e.currentTarget.style.cursor = mode === "move" ? "grab" : "ew-resize";
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || !ref.current || !rootRef.current) return;
        e.stopPropagation();
        timeline.selectClip(clip.id, e.shiftKey || e.metaKey || e.ctrlKey);
        startClipGesture({
          bus,
          clip,
          element: ref.current,
          root: rootRef.current,
          down: e.nativeEvent,
          view: timeline.view,
          playback,
          media,
          project,
        });
      }}
    >
      {poster && kind === "video" && (
        <div
          className="pointer-events-none absolute inset-0 bg-repeat-x opacity-40"
          style={{ backgroundImage: `url(${poster})`, backgroundSize: "auto 100%" }}
        />
      )}
      <span className="pointer-events-none relative block truncate px-2 py-1 drop-shadow">
        {name}
      </span>
      <div className="absolute inset-y-0 left-0 w-1 bg-white/0 group-hover:bg-white/40" />
      <div className="absolute inset-y-0 right-0 w-1 bg-white/0 group-hover:bg-white/40" />
    </div>
  );
});
