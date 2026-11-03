import { ChevronRight } from "lucide-react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { timeOfContent, type Clip } from "@/modules/project";
import { timelineRef, timeToPx } from "@/modules/timeline";
import { cn } from "@/ui";
import { keyframeRef } from "../keyframe.ref";
import { toggleMode } from "../keyframe.view.commands";

/**
 * Over a selected clip that has keys: an arrow that opens (or closes) the panel, and in Normal a
 * small diamond on the bottom edge for each time a key sits.
 */
export function ClipBadge({ clip, selected }: { clip: Clip; selected: boolean }) {
  const { bus } = useKernel();
  const mode = useStore(useModule(keyframeRef).view, (s) => s.mode);
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const tracks = Object.values(clip.animation ?? {});
  if (!selected || tracks.length === 0) return null;

  const end = clip.start + clip.duration;
  const times = [
    ...new Set(
      tracks.flatMap((track) =>
        track.keys
          .map((key) => timeOfContent(clip, key.t))
          .filter((t) => t >= clip.start && t < end),
      ),
    ),
  ];
  const open = mode !== "normal";
  return (
    <>
      {!open &&
        times.map((time) => (
          <i
            key={time}
            className="absolute bottom-[3px] -ml-[3px] size-1.5 rotate-45 bg-muted-foreground"
            style={{ left: timeToPx(time - clip.start, pxPerSecond) }}
          />
        ))}
      <button
        type="button"
        title={open ? "Back to the plain timeline (K)" : "Show keyframes (K)"}
        aria-label={open ? "Hide keyframes" : "Show keyframes"}
        className="pointer-events-auto absolute right-1 top-1 grid size-4 cursor-pointer place-items-center rounded-xs bg-surface/80 text-foreground hover:bg-on hover:text-background"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void bus.run(toggleMode, {});
        }}
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
      </button>
    </>
  );
}
