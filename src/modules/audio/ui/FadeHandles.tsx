import { useRef } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef, soundOf, type Clip } from "@/modules/project";
import { timelineRef, timeToPx } from "@/modules/timeline";
import { cn } from "@/ui";
import { setSound } from "../audio.commands";
import type { FadeEdge } from "../audio.types";
import { FADE_AREA, FADE_LINE } from "../logic/fade";
import { startFadeGesture } from "./fade.gesture";

/**
 * Over a clip of an audio track: the slope of each fade and a handle at the top corner to drag it.
 * The drag writes the slope with `style`; the release is one `audio.setSound`.
 */
export function FadeHandles({ clip, selected }: { clip: Clip; selected: boolean }) {
  const { bus } = useKernel();
  const kind = useStore(useModule(projectRef).store.api, (s) => s.tracks[clip.trackId]?.kind);
  const pxPerSecond = useStore(useModule(timelineRef).view, (s) => s.pxPerSecond);
  const sound = soundOf(clip);
  if (kind !== "audio") return null;
  const width = timeToPx(clip.duration, pxPerSecond);
  const shared = { bus, clip, pxPerSecond, width, selected };
  return (
    <>
      <Fade edge="in" fade={sound.fadeIn} {...shared} />
      <Fade edge="out" fade={sound.fadeOut} {...shared} />
    </>
  );
}

function Fade(props: {
  edge: FadeEdge;
  fade: number;
  bus: ReturnType<typeof useKernel>["bus"];
  clip: Clip;
  pxPerSecond: number;
  width: number;
  selected: boolean;
}) {
  const { edge, fade, bus, clip, pxPerSecond, width, selected } = props;
  const slope = useRef<SVGSVGElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const side = edge === "in" ? "left" : "right";
  const px = (micros: number) => Math.min(width, timeToPx(micros, pxPerSecond));

  const show = (micros: number) => {
    const size = `${px(micros)}px`;
    if (slope.current) slope.current.style.width = size;
    if (handle.current) handle.current.style[side] = size;
  };

  return (
    <>
      <svg
        ref={slope}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className={cn(
          "pointer-events-none absolute inset-y-0 h-full overflow-visible",
          edge === "in" ? "left-0" : "right-0 -scale-x-100",
        )}
        style={{ width: px(fade) }}
      >
        <polygon points={FADE_AREA} className="fill-background/50" />
        <polyline
          points={FADE_LINE}
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-foreground"
          strokeWidth={1}
        />
      </svg>
      <div
        ref={handle}
        title={edge === "in" ? "Fade in" : "Fade out"}
        className={cn(
          "pointer-events-auto absolute top-0 size-2.5 cursor-ew-resize rounded-xs border border-border-strong bg-foreground",
          edge === "in" ? "-ml-px" : "-mr-px",
          !selected && "opacity-0 group-hover:opacity-100",
        )}
        style={{ [side]: px(fade) }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          startFadeGesture({
            down: e.nativeEvent,
            edge,
            current: fade,
            duration: clip.duration,
            pxPerSecond,
            onPreview: show,
            onDrop(next) {
              const patch = edge === "in" ? { fadeIn: next } : { fadeOut: next };
              void bus.run(setSound, { clipIds: [clip.id], patch }).then((result) => {
                if (!result.ok) show(fade);
              });
            },
          });
        }}
      />
    </>
  );
}
