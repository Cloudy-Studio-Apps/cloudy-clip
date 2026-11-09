import { useRef } from "react";
import { useKernel, useModule } from "@/core";
import { projectRef, type TrackId } from "@/modules/project";
import { TIMELINE_CONTENT } from "@/modules/timeline";
import type { StrokePoint } from "../../sound.types";
import { startStroke } from "./trackline.gesture";
import { sendStroke } from "./trackline.stroke";

interface TrackLineStrokeProps {
  trackId: TrackId;
  /** The track's line is in front: the stroke writes it, else the clip under its start. */
  inFront: boolean;
  pxPerSecond: number;
  /** The stretch drawn, in px of the timeline. */
  from: number;
  to: number;
}

/**
 * Draw volume over one lane: a surface over the track line's box (crosshair) that takes a stroke,
 * draws it in `--mark` through the DOM as it goes and sends it on release (`sendStroke`). It sits
 * in the box of `TrackLineLane`, whose left edge is the timeline's start.
 */
export function TrackLineStroke({ trackId, inFront, pxPerSecond, from, to }: TrackLineStrokeProps) {
  const { bus } = useKernel();
  const project = useModule(projectRef).store;
  const surface = useRef<HTMLDivElement>(null);
  const stroke = useRef<SVGPolylineElement>(null);

  const draw = (down: PointerEvent) => {
    const area = surface.current;
    const content = area?.closest<HTMLElement>(TIMELINE_CONTENT);
    if (!area || !content) return;
    const origin = area.getBoundingClientRect();
    const trace = (stroked: readonly StrokePoint[]) =>
      stroke.current?.setAttribute(
        "points",
        stroked
          .map((p) => `${(p.clientX - origin.left - from).toFixed(1)},${p.clientY - origin.top}`)
          .join(" "),
      );
    startStroke({
      down,
      onMove: trace,
      onEnd(stroked) {
        trace([]);
        if (!stroked) return;
        sendStroke(stroked, {
          bus,
          state: project.getState(),
          trackId,
          inFront,
          box: area.getBoundingClientRect(),
          content,
          pxPerSecond,
        });
      },
    });
  };

  return (
    <div
      ref={surface}
      className="pointer-events-auto absolute inset-0 cursor-crosshair"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        draw(e.nativeEvent);
      }}
    >
      <svg
        className="pointer-events-none absolute inset-y-0 overflow-visible"
        style={{ left: from, width: Math.max(1, to - from) }}
      >
        <polyline ref={stroke} className="fill-none stroke-mark" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
