import { Link, Rewind, Snowflake } from "lucide-react";
import { memo, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { ErrorBoundary, useKernel, useModule, usePoint } from "@/core";
import { junctionRef } from "@/modules/junction";
import { mediaRef } from "@/modules/media";
import { elementRef, type ElementDisplay } from "@/modules/element";
import { type Clip, type ProjectState, partnersOf, projectRef, speedOf } from "@/modules/project";
import { previewRef } from "@/modules/preview";
import { cn, ContextMenu } from "@/ui";
import { clipActions } from "../timeline.points";
import { timelineRef } from "../timeline.ref";
import { timeToPx } from "../logic/geometry";
import { arrangeMenu } from "../logic/menu";
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
  const junctions = useModule(junctionRef);
  const { playback } = useModule(previewRef);
  const media = useModule(mediaRef);
  const { bus } = useKernel();
  const ref = useRef<HTMLDivElement>(null);
  const selected = useStore(timeline.view, (s) => s.selection.includes(clip.id));
  const shift = useStore(timeline.view, (s) => s.cutPreview?.shifts[clip.id] ?? 0);
  const elements = useModule(elementRef);
  const mediaId = clip.mediaId;
  // One string, so the selector's result is stable (the display reads media names and tracks);
  // color and body never hold a line break, the label may.
  const look = useStore(project.api, (s: ProjectState) => {
    const shown = elements
      .get(clip.kind)
      ?.definition.display(clip, { project: s, track: s.tracks[clip.trackId] });
    return `${shown?.color ?? "clip-video"}\n${shown?.body ?? "none"}\n${shown?.label ?? clip.kind}`;
  });
  const [color, bodyName, label] = useMemo(() => {
    const first = look.indexOf("\n");
    const second = look.indexOf("\n", first + 1);
    return [look.slice(0, first), look.slice(first + 1, second), look.slice(second + 1)];
  }, [look]);
  const body = bodyName as ElementDisplay["body"];
  const poster = useStore(media.probes, (s) =>
    mediaId ? s.probes[mediaId]?.posterUrl : undefined,
  );
  const linked = useStore(project.api, (s) => partnersOf(s, clip.id).length > 0);
  const actions = usePoint(clipActions);
  const { rate, reversed } = speedOf(clip);
  const badges = useMemo(
    () => actions.flatMap((a) => (a.badge ? [{ id: a.id, Badge: a.badge }] : [])),
    [actions],
  );

  return (
    <ContextMenu
      items={() => {
        if (!timeline.view.getState().selection.includes(clip.id)) timeline.selectClip(clip.id);
        return arrangeMenu(actions.flatMap((action) => action.items?.(clip) ?? []));
      }}
    >
      <div
        ref={ref}
        data-clip-id={clip.id}
        data-collab-target={`clip:${clip.id}`}
        className={cn(
          "group absolute bottom-[3px] top-[3px] overflow-hidden text-clip-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] select-none data-[invalid=true]:!bg-destructive data-[invalid=true]:!outline-destructive",
          selected && "z-10 outline-2 outline-offset-1 outline-mark",
          clip.disabled && "opacity-40",
          shift !== 0 && "transition-transform duration-100",
        )}
        style={{
          backgroundColor: `var(--${color})`,
          left: timeToPx(clip.start, pxPerSecond),
          width: timeToPx(clip.duration, pxPerSecond),
          transform: shift !== 0 ? `translateX(${timeToPx(shift, pxPerSecond)}px)` : undefined,
        }}
        onDoubleClick={() => actions.some((action) => action.doubleClick?.(clip))}
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
            kindOf: (kind) => junctions.get(kind)?.definition,
          });
        }}
      >
        <ClipBody body={body} poster={poster} />
        <div className="pointer-events-none absolute left-0 top-0 flex h-[17px] max-w-full items-center gap-1 border-b border-r border-border-strong bg-surface px-[5px] font-mono text-xs font-bold">
          {linked && <Link aria-label="Linked" className="size-3 shrink-0" />}
          <span className="min-w-0 truncate">{label}</span>
          {rate !== 1 && rate > 0 && <span className="shrink-0 text-mark">{rate.toFixed(2)}x</span>}
          {reversed && <Rewind aria-label="Reversed" className="size-3 shrink-0 text-mark" />}
          {rate === 0 && (
            <Snowflake aria-label="Held frame" className="size-3 shrink-0 text-mark" />
          )}
        </div>
        {badges.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            {badges.map(({ id, Badge }) => (
              <ErrorBoundary key={id} name={id}>
                <Badge clip={clip} selected={selected} />
              </ErrorBoundary>
            ))}
          </div>
        )}
        {/* Trim handles: brackets on hover. */}
        <div className="pointer-events-none absolute inset-y-0 -left-px w-[7px] group-hover:border-l-[3px] group-hover:border-foreground" />
        <div className="pointer-events-none absolute inset-y-0 -right-px w-[7px] group-hover:border-r-[3px] group-hover:border-foreground" />
      </div>
    </ContextMenu>
  );
});
