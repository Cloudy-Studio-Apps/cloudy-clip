import { useRef } from "react";
import type { CommandBus } from "@/core";
import type { Clip } from "@/modules/project";
import { timeToPx } from "@/modules/timeline";
import { cn } from "@/ui";
import { setSound } from "../audio.commands";
import type { FadeBox, FadeEdge } from "../audio.types";
import { FADE_AREA, FADE_LINE } from "../logic/fade";
import { startFadeGesture } from "./fade.gesture";

/** One fade of a clip: its slope and the handle that drags it. */
export function Fade(props: {
  edge: FadeEdge;
  fade: number;
  /** Where the handle sits (see `handleBoxes`). */
  box: FadeBox;
  /** Gets the handle element, so the owner can place both handles during a drag. */
  handleRef(element: HTMLDivElement | null): void;
  /** A fade shown during a drag, so the owner can place both handles. */
  onShow(micros: number): void;
  bus: CommandBus;
  clip: Clip;
  pxPerSecond: number;
  width: number;
  selected: boolean;
}) {
  const { edge, fade, box, handleRef, onShow, bus, clip, pxPerSecond, width, selected } = props;
  const slope = useRef<SVGSVGElement>(null);
  const px = (micros: number) => Math.min(width, timeToPx(micros, pxPerSecond));
  const show = (micros: number) => {
    if (slope.current) slope.current.style.width = `${px(micros)}px`;
    onShow(micros);
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
        ref={handleRef}
        title={edge === "in" ? "Fade in" : "Fade out"}
        className={cn(
          "pointer-events-auto absolute top-0 h-2.5 cursor-ew-resize rounded-xs border border-border-strong bg-foreground",
          !selected && "opacity-0 group-hover:opacity-100",
        )}
        style={{ left: box.left, width: box.size }}
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
