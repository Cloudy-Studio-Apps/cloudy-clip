import { useLayoutEffect, useRef } from "react";
import { cn } from "@/ui";
import { grabPart, outsideStops } from "../../logic/range";
import type { RangeWindow } from "../../tint.types";
import { startRangeDrag } from "./range.gesture";

interface RangeBarProps {
  label: string;
  /** CSS background of the bar: what the range runs over. */
  background: string;
  /** The window, as shares of the bar. */
  window: RangeWindow;
  /** A hue bar: the window may run over the end and on from the start. */
  wrap?: boolean;
  /** The readout of a window. */
  format(window: RangeWindow): string;
  disabled?: boolean;
  /** While dragging, the window as it would be (live). */
  onMove(window: RangeWindow): void;
  /** Once per drag: the window on release, or null when nothing changed or it was cancelled. */
  onEnd(window: RangeWindow | null): void;
}

/** How near an end (px) a press grabs it rather than the window. */
const GRAB = 6;
/** The shade over what is outside the window: over a strip of colors, so a fixed color. */
const SHADE = "rgb(14 16 19 / 0.6)";

/**
 * A range over a strip of hues, saturations or brightness, with its window: drag an end to move
 * it, or the inside to move the window. While dragging only the DOM changes; the caller gets the
 * window live and once on release.
 */
export function RangeBar({
  label,
  background,
  window: value,
  wrap = false,
  format,
  disabled,
  onMove,
  onEnd,
}: RangeBarProps) {
  const bar = useRef<HTMLSpanElement>(null);
  const shade = useRef<HTMLSpanElement>(null);
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  const paint = ([from, to]: RangeWindow) => {
    if (!shade.current || !first.current || !second.current || !readout.current) return;
    shade.current.style.background = `linear-gradient(90deg, ${outsideStops([from, to], SHADE)})`;
    const split = from > to;
    first.current.style.left = `${from * 100}%`;
    first.current.style.width = `${((split ? 1 : to) - from) * 100}%`;
    second.current.style.display = split ? "" : "none";
    second.current.style.width = `${to * 100}%`;
    readout.current.textContent = format([from, to]);
  };
  useLayoutEffect(() => paint(value));

  const press = (event: React.PointerEvent) => {
    if (disabled || event.button !== 0 || !bar.current) return;
    event.preventDefault();
    const rect = bar.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
    startRangeDrag({
      event: event.nativeEvent,
      bar: bar.current,
      window: value,
      part: grabPart(value, x, GRAB / Math.max(rect.width, 1), wrap),
      wrap,
      onMove(next) {
        paint(next);
        onMove(next);
      },
      onEnd(next) {
        const same = next && next[0] === value[0] && next[1] === value[1];
        if (!next || same) paint(value);
        onEnd(same ? null : next);
      },
    });
  };

  const edge = "absolute -inset-y-px rounded-xs border-[1.5px] border-foreground";
  return (
    <div className="flex h-8 items-center gap-2">
      <span className="w-[74px] shrink-0 text-base text-muted-foreground">{label}</span>
      <span
        ref={bar}
        onPointerDown={press}
        className={cn(
          "relative h-4 min-w-0 flex-1 touch-none overflow-hidden rounded-xs",
          disabled ? "opacity-50" : "cursor-ew-resize",
        )}
        style={{ background }}
      >
        <span ref={shade} className="absolute inset-0" />
        <span ref={first} className={edge} />
        <span ref={second} className={cn(edge, "left-0")} />
      </span>
      <span
        ref={readout}
        className="w-[76px] shrink-0 rounded-xs bg-background px-1.5 py-0.5 text-right font-mono text-sm"
      />
    </div>
  );
}
