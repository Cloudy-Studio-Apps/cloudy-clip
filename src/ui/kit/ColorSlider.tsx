import { CHECKERBOARD, COLOR_KEY_STEP } from "./kit.color";
import { usePointerDrag } from "./kit.pointer";
import type { ColorChangeInfo } from "./kit.types";

interface ColorSliderProps {
  label: string;
  /** 0–1. */
  value: number;
  /** A CSS gradient for the track. */
  track: string;
  /** Draw a checkerboard under the track (opacity). */
  checkered?: boolean;
  onChange(value: number, info: ColorChangeInfo): void;
}

/** A horizontal track with a thumb, for hue or opacity. */
export function ColorSlider({ label, value, track, checkered, onChange }: ColorSliderProps) {
  const drag = usePointerDrag(({ x }, info) => onChange(x, info));
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      {...drag}
      onKeyDown={(event) => {
        const step = (event.shiftKey ? 10 : 1) * COLOR_KEY_STEP;
        const delta = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
        if (delta === 0) return;
        event.preventDefault();
        onChange(Math.min(1, Math.max(0, value + delta)), { done: true });
      }}
      className="relative h-3 w-full cursor-pointer touch-none rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ background: checkered ? `${track}, ${CHECKERBOARD}` : track }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-xs border border-white shadow-soft"
        style={{ left: `${value * 100}%` }}
      />
    </div>
  );
}
