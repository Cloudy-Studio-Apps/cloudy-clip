import { memo } from "react";
import { formatTimecode, MICROS_PER_SECOND, type Micros, useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { pxToTime, rulerStep, timeToPx } from "../logic/geometry";
import { HEADER_WIDTH, RULER_HEIGHT } from "../timeline.layout";
import { PlayheadHead } from "./Playhead";

/** Minor ticks drawn between two labelled ones. */
const MINOR_PER_STEP = 5;

interface RulerProps {
  pxPerSecond: number;
  /** Rendered window (ticks outside it are skipped). */
  from: Micros;
  to: Micros;
  width: number;
}

/** Time ruler. Press and drag on it to scrub. Sticks to the top while scrolling. */
export const Ruler = memo(function Ruler({ pxPerSecond, from, to, width }: RulerProps) {
  const { playback } = useModule(previewRef);
  const stepMicros = rulerStep(pxPerSecond) * MICROS_PER_SECOND;
  const minorMicros = stepMicros / MINOR_PER_STEP;
  const ticks: Micros[] = [];
  for (let t = Math.floor(from / stepMicros) * stepMicros; t <= to; t += minorMicros) {
    ticks.push(Math.round(t));
  }

  const scrubTo = (target: HTMLElement, clientX: number) => {
    const left = target.getBoundingClientRect().left;
    playback.seek(Math.max(0, pxToTime(clientX - left, pxPerSecond)));
  };

  return (
    <div className="sticky top-0 z-30 flex" style={{ height: RULER_HEIGHT }}>
      <div
        className="sticky left-0 z-40 shrink-0 border-b border-r border-border bg-surface"
        style={{ width: HEADER_WIDTH }}
      />
      <div
        className="relative cursor-col-resize border-b border-border bg-surface"
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
        {ticks.map((t, i) => {
          const major = i % MINOR_PER_STEP === 0;
          return (
            <div
              key={t}
              className={`pointer-events-none absolute bottom-0 w-px ${
                major ? "h-2.5 bg-subtle-foreground" : "h-1 bg-border-strong"
              }`}
              style={{ left: timeToPx(t, pxPerSecond) }}
            >
              {major && (
                <span className="absolute bottom-[9px] left-1 whitespace-nowrap font-mono text-2xs text-subtle-foreground">
                  {formatTimecode(t)}
                </span>
              )}
            </div>
          );
        })}
        <PlayheadHead />
      </div>
    </div>
  );
});
