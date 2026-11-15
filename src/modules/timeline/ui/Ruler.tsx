import { memo } from "react";
import { formatTimecode, MICROS_PER_SECOND, type Micros } from "@/core";
import { rulerStep, timeToPx } from "../logic/geometry";
import { RULER_HEIGHT } from "../timeline.layout";
import { useHeaderWidth } from "./header.width.hook";
import { LoopBand } from "./LoopBand";
import { PlayheadHead } from "./Playhead";
import { useScrubDrag } from "./scrub.hook";

/** Minor ticks drawn between two labelled ones. */
const MINOR_PER_STEP = 5;

interface RulerProps {
  pxPerSecond: number;
  /** The loop band sits on the ruler (`"all"`) or in the marks row under it (`"sound"`). */
  loop: boolean;
  /** Rendered window (ticks outside it are skipped). */
  from: Micros;
  to: Micros;
  width: number;
}

/**
 * Time ruler. Press and drag on it to scrub: the playhead snaps to clip edges, cuts and markers
 * unless Ctrl (Cmd) is held, and each move plays a slice of sound (`PreviewApi.scrub`). The loop
 * region sits on it (`LoopBand`) unless the marks row holds it (`loop` false). Sticks to the top
 * while scrolling.
 */
export const Ruler = memo(function Ruler({ pxPerSecond, loop, from, to, width }: RulerProps) {
  const scrub = useScrubDrag();
  const headerWidth = useHeaderWidth();
  const stepMicros = rulerStep(pxPerSecond) * MICROS_PER_SECOND;
  const minorMicros = stepMicros / MINOR_PER_STEP;
  const ticks: Micros[] = [];
  for (let t = Math.floor(from / stepMicros) * stepMicros; t <= to; t += minorMicros) {
    ticks.push(Math.round(t));
  }

  return (
    <div className="sticky top-0 z-30 flex" style={{ height: RULER_HEIGHT }}>
      <div
        className="sticky left-0 z-40 shrink-0 border-b-[1.5px] border-r-[1.5px] border-subtle-foreground bg-muted"
        style={{ width: headerWidth }}
      />
      <div
        className="relative cursor-col-resize border-b-[1.5px] border-subtle-foreground bg-surface"
        style={{ width }}
        onPointerDown={(e) => {
          if (e.button === 0) scrub(e.nativeEvent, e.currentTarget);
        }}
      >
        {ticks.map((t, i) => {
          const major = i % MINOR_PER_STEP === 0;
          return (
            <div
              key={t}
              className={`pointer-events-none absolute bottom-0 w-px ${
                major ? "h-full bg-subtle-foreground" : "h-[5px] bg-subtle-foreground"
              }`}
              style={{ left: timeToPx(t, pxPerSecond) }}
            >
              {major && (
                <span className="absolute bottom-1 left-1 whitespace-nowrap font-mono text-xs font-bold">
                  {formatTimecode(t)}
                </span>
              )}
            </div>
          );
        })}
        {loop && <LoopBand pxPerSecond={pxPerSecond} />}
        <PlayheadHead />
      </div>
    </div>
  );
});
