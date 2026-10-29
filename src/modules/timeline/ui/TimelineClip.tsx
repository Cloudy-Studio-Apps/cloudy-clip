import { Link } from "lucide-react";
import { memo, useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { mediaRef } from "@/modules/media";
import { elementRef } from "@/modules/element";
import { type Clip, type ProjectState, projectRef } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { cn } from "@/ui";
import { timelineRef } from "../timeline.ref";
import { timeToPx } from "../logic/geometry";
import { partnersOf } from "../logic/links";
import { ClipBody } from "./ClipBody";
import { gestureMode, startClipGesture } from "./clip.gesture";

interface TimelineClipProps {
  clip: Clip;
  pxPerSecond: number;
  /** The scroll root, used to find lanes during a drag. */
  rootRef: React.RefObject<HTMLDivElement | null>;
}

/** One clip on a lane. Drag the body to move it, the edges to trim it. */
export const TimelineClip = memo(function TimelineClip({
  clip,
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
  const elements = useModule(elementRef);
  const mediaId = clip.mediaId;
  // Strings only, so each selector's result is stable (the display reads media names and tracks).
  const look = (s: ProjectState) =>
    elements
      .get(clip.kind)
      ?.definition.display(clip, { project: s, track: s.tracks[clip.trackId] });
  const label = useStore(project.api, (s) => look(s)?.label ?? clip.kind);
  const color = useStore(project.api, (s) => look(s)?.color ?? "clip-video");
  const body = useStore(project.api, (s) => look(s)?.body ?? "none");
  const poster = useStore(media.probes, (s) =>
    mediaId ? s.probes[mediaId]?.posterUrl : undefined,
  );
  const linked = useStore(project.api, (s) => partnersOf(s, clip.id).length > 0);

  return (
    <div
      ref={ref}
      data-clip-id={clip.id}
      className={cn(
        "group absolute bottom-[3px] top-[3px] overflow-hidden rounded-xs border text-white select-none data-[invalid=true]:!border-destructive data-[invalid=true]:!bg-destructive",
        selected ? "border-white shadow-[inset_0_0_0_1px_white]" : "border-black/30",
      )}
      style={{
        backgroundColor: `var(--${color})`,
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
      <div className="pointer-events-none flex h-[17px] items-center gap-1 bg-black/25 px-1.5 text-xs font-medium">
        {linked && <Link aria-label="Linked" className="size-3 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </div>
      <ClipBody body={body} poster={poster} />
      {/* Trim handles: brackets on hover. */}
      <div className="pointer-events-none absolute inset-y-0 -left-px w-[7px] group-hover:border-l-[3px] group-hover:border-white" />
      <div className="pointer-events-none absolute inset-y-0 -right-px w-[7px] group-hover:border-r-[3px] group-hover:border-white" />
    </div>
  );
});
