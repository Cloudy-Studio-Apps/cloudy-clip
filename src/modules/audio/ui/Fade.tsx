import { useRef } from "react";
import type { CommandBus } from "@/core";
import type { Clip } from "@/modules/project";
import { timeToPx } from "@/modules/timeline";
import { cn } from "@/ui";
import { setSound } from "../audio.commands";
import type { FadeEdge } from "../audio.types";
import { FADE_AREA, FADE_LINE, handleOffset } from "../logic/fade";
import { startFadeGesture } from "./fade.gesture";

/** One fade of a clip: its slope and the handle that drags it. */
export function Fade(props: {
  edge: FadeEdge;
  fade: number;
  /** The other fade of the clip. */
  other: number;
  bus: CommandBus;
  clip: Clip;
  pxPerSecond: number;
  width: number;
  selected: boolean;
}) {
  const { edge, fade, other, bus, clip, pxPerSecond, width, selected } = props;
  const slope = useRef<SVGSVGElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const side = edge === "in" ? "left" : "right";
  const px = (micros: number) => Math.min(width, timeToPx(micros, pxPerSecond));
  // The slope shows the true fade; the handle stays inside the clip and clear of the other.
  const at = (micros: number) =>
    handleOffset(edge, timeToPx(micros, pxPerSecond), timeToPx(other, pxPerSecond), width);

  const show = (micros: number) => {
    const size = `${px(micros)}px`;
    if (slope.current) slope.current.style.width = size;
    if (handle.current) handle.current.style[side] = `${at(micros)}px`;
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
          !selected && "opacity-0 group-hover:opacity-100",
        )}
        style={{ [side]: at(fade) }}
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
