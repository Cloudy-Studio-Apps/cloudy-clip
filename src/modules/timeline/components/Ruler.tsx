import { memo } from "react";
import { formatTimecode, MICROS_PER_SECOND, type Micros } from "@/core";
import { playback } from "@/modules/preview";
import { pxToTime, rulerStep, timeToPx } from "../logic/geometry";
import { HEADER_WIDTH, RULER_HEIGHT } from "../timeline.layout";

interface RulerProps {
  pxPerSecond: number;
  /** Rendered window (labels outside it are skipped). */
  from: Micros;
  to: Micros;
  width: number;
}

/** Time ruler. Press and drag on it to scrub. Sticks to the top while scrolling. */
export const Ruler = memo(function Ruler({ pxPerSecond, from, to, width }: RulerProps) {
  const step = rulerStep(pxPerSecond);
  const stepMicros = step * MICROS_PER_SECOND;
  const ticks: Micros[] = [];
  for (let t = Math.floor(from / stepMicros) * stepMicros; t <= to; t += stepMicros) ticks.push(t);

  const scrubTo = (target: HTMLElement, clientX: number) => {
    const left = target.getBoundingClientRect().left;
    playback.seek(Math.max(0, pxToTime(clientX - left, pxPerSecond)));
  };

  return (
    <div className="sticky top-0 z-30 flex" style={{ height: RULER_HEIGHT }}>
      <div
        className="sticky left-0 z-40 shrink-0 border-b border-r border-neutral-800 bg-neutral-900"
        style={{ width: HEADER_WIDTH }}
      />
      <div
        className="relative cursor-pointer border-b border-neutral-800 bg-neutral-900"
        style={{ width }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const target = e.currentTarget;
          target.setPointerCapture(e.pointerId);
          scrubTo(target, e.clientX);
          const move = (ev: PointerEvent) => scrubTo(target, ev.clientX);
          const up = () => {
            target.removeEventListener("pointermove", move);
            target.removeEventListener("pointerup", up);
            target.removeEventListener("pointercancel", up);
          };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", up);
          target.addEventListener("pointercancel", up);
        }}
      >
        {ticks.map((t) => (
          <div
            key={t}
            className="pointer-events-none absolute bottom-0 h-2 border-l border-neutral-600"
            style={{ left: timeToPx(t, pxPerSecond) }}
          >
            <span className="absolute -top-3.5 left-1 whitespace-nowrap text-[10px] tabular-nums text-neutral-500">
              {formatTimecode(t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
