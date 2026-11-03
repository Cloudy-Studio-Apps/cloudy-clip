import { memo } from "react";
import { MARKS_HEIGHT, RULER_HEIGHT } from "../timeline.layout";
import { useHeaderWidth } from "./header.width.hook";
import { LoopBand } from "./LoopBand";
import { PlayheadHead } from "./Playhead";

interface MarksRowProps {
  pxPerSecond: number;
  width: number;
}

/**
 * The marks row under the ruler, on a sound-scope timeline: the loop band sits here, and overlays
 * put their flags here through `useFlagRow` (markers). It takes no scrub; the ruler keeps it.
 * Sticks under the ruler while scrolling.
 */
export const MarksRow = memo(function MarksRow({ pxPerSecond, width }: MarksRowProps) {
  const headerWidth = useHeaderWidth();
  return (
    <div className="sticky z-30 flex" style={{ top: RULER_HEIGHT, height: MARKS_HEIGHT }}>
      <div
        className="sticky left-0 z-40 shrink-0 border-b border-r-[1.5px] border-b-border border-r-subtle-foreground bg-muted"
        style={{ width: headerWidth }}
      />
      <div className="relative border-b border-border bg-surface" style={{ width }}>
        <LoopBand pxPerSecond={pxPerSecond} />
        <PlayheadHead bare />
      </div>
    </div>
  );
});
