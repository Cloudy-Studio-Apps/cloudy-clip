import { RotateCcw } from "lucide-react";
import { useRef } from "react";
import type { Wheel } from "@/modules/project";
import { wheelNumbers, wheelWithNumber } from "../../logic/color/wheels";
import { CHANNEL_COLORS } from "./channel.colors";
import { startJogDrag } from "./jog.gesture";
import type { WheelEdit } from "./tools.types";

/** Height of a bar, in px: dragging all along it moves its number by 2. */
const HEIGHT = 150;
const NAMES = ["Y", "R", "G", "B"] as const;
const COLORS = ["var(--foreground)", ...CHANNEL_COLORS] as const;

/** Where a bar's fill sits for a number from -1 to 1: from the middle to the number. */
const fillAt = (value: number) => ({
  bottom: `${50 + Math.min(value, 0) * 50}%`,
  height: `${Math.abs(value) * 50}%`,
});
/** Where a bar's thumb sits. */
const thumbAt = (value: number) => ({ bottom: `${(value + 1) * 50}%` });

interface WheelBarGroupProps {
  label: string;
  wheel: Wheel;
  /** Makes the bars real. Without it they only show the value. */
  edit?: WheelEdit;
}

/**
 * One wheel as four bars (master, red, green, blue). Dragging a bar up or down moves that number;
 * the color numbers add up to 0, so the other two follow. The bars and the live values follow in
 * the DOM; the wheel is saved once, on release, and Escape cancels.
 */
export function WheelBarGroup({ label, wheel, edit }: WheelBarGroupProps) {
  const bars = useRef<HTMLDivElement>(null);
  const paint = (next: Wheel) => {
    const numbers = wheelNumbers(next);
    bars.current?.querySelectorAll<HTMLElement>("[data-bar]").forEach((bar, i) => {
      const fill = bar.querySelector<HTMLElement>("[data-fill]");
      const thumb = bar.querySelector<HTMLElement>("[data-thumb]");
      if (fill) Object.assign(fill.style, fillAt(numbers[i]!));
      if (thumb) Object.assign(thumb.style, thumbAt(numbers[i]!));
    });
  };
  const numbers = wheelNumbers(wheel);
  return (
    <div className="flex flex-col items-center gap-2">
      <h5 className="flex items-center gap-1.5 font-hand text-base font-bold">
        {label}
        {edit && (
          <button
            type="button"
            title={`Reset ${label}`}
            onClick={edit.reset}
            className="cursor-pointer text-subtle-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
          </button>
        )}
      </h5>
      <div ref={bars} className="flex gap-2" style={{ height: HEIGHT }}>
        {NAMES.map((name, i) => {
          const value = numbers[i]!;
          return (
            <div key={name} className="flex flex-col items-center gap-1">
              <span
                data-bar
                title={`${label} ${name}: drag up or down`}
                className={`relative block w-1.5 flex-1 rounded-xs bg-background ${edit ? "cursor-ns-resize touch-none" : ""}`}
                onPointerDown={(event) => {
                  if (!edit) return;
                  event.preventDefault();
                  let last = wheel;
                  startJogDrag({
                    event: event.nativeEvent,
                    width: HEIGHT,
                    start: value,
                    axis: "y",
                    onMove(v) {
                      last = wheelWithNumber(wheel, i, v);
                      paint(last);
                      edit.preview(last);
                    },
                    onEnd(v) {
                      if (
                        v === null ||
                        (last.x === wheel.x && last.y === wheel.y && last.m === wheel.m)
                      ) {
                        paint(wheel);
                        edit.cancel();
                      } else edit.commit(last);
                    },
                  });
                }}
              >
                <i
                  data-fill
                  className="absolute inset-x-0 block rounded-xs"
                  style={{ background: COLORS[i], ...fillAt(value) }}
                />
                <i
                  data-thumb
                  className="absolute left-1/2 block size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-[1.5px] border-foreground bg-surface"
                  style={thumbAt(value)}
                />
              </span>
              <span className="font-mono text-2xs text-subtle-foreground">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
