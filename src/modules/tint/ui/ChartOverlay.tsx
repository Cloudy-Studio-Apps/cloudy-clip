import { useLayoutEffect, useRef } from "react";
import { FrameBox } from "./FrameBox";
import { startCornerDrag } from "./chart.gesture";
import { paintChart } from "./chart.paint";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const CORNER_NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"] as const;

/**
 * The color chart being placed (`view.chart`): a 6 × 4 grid over the viewer's picture, held by its
 * four corners. A corner drags from where it was grabbed (after 3 px), painted in the DOM; release
 * keeps the corners in the view (never in history), Escape puts it back. Match's Calibrate reads
 * them. The box follows the preview's canvas each frame, so the corners stay on the picture
 * whatever the viewer does.
 */
export function ChartOverlay({ stage }: { stage: React.RefObject<HTMLElement | null> }) {
  const corners = useTintView((v) => v.chart);
  const set = useTintSet();
  const box = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  useLayoutEffect(() => {
    if (corners) paintChart(path.current, handles.current, corners);
  }, [corners]);
  if (!corners) return null;

  const grab = (index: number, event: React.PointerEvent) => {
    if (event.button !== 0 || !box.current) return;
    event.preventDefault();
    const paint = (at: typeof corners) => paintChart(path.current, handles.current, at);
    startCornerDrag({
      event: event.nativeEvent,
      box: box.current,
      corners,
      index,
      onMove: paint,
      onEnd: (end) => (end ? set({ chart: end }) : paint(corners)),
    });
  };
  return (
    <FrameBox stage={stage} ref={box}>
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <path
          ref={path}
          fill="none"
          className="stroke-foreground drop-shadow-[0_0_1px_black]"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {CORNER_NAMES.map((name, i) => (
        <button
          key={name}
          type="button"
          ref={(el) => {
            handles.current[i] = el;
          }}
          aria-label={`${name} corner of the chart`}
          title={`${name} corner: drag it onto the chart's corner`}
          onPointerDown={(event) => grab(i, event)}
          className="pointer-events-auto absolute size-3.5 -translate-1/2 cursor-move rounded-xs border-[1.5px] border-foreground shadow-[0_0_0_1px_black]"
        />
      ))}
    </FrameBox>
  );
}
