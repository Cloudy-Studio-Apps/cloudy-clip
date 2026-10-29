import { COLOR_KEY_STEP } from "./kit.color";
import { usePointerDrag } from "./kit.pointer";
import { hsvToHex } from "../lib/color";
import type { ColorChangeInfo, Hsv } from "./kit.types";

interface ColorAreaProps {
  hsv: Hsv;
  onChange(hsv: Hsv, info: ColorChangeInfo): void;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The square where saturation (left to right) and brightness (bottom to top) are picked. */
export function ColorArea({ hsv, onChange }: ColorAreaProps) {
  const drag = usePointerDrag(({ x, y }, info) => onChange({ ...hsv, s: x, v: 1 - y }, info));
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      {...drag}
      onKeyDown={(event) => {
        const step = (event.shiftKey ? 10 : 1) * COLOR_KEY_STEP;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, step],
          ArrowDown: [0, -step],
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        onChange(
          { ...hsv, s: clamp01(hsv.s + move[0]), v: clamp01(hsv.v + move[1]) },
          { done: true },
        );
      }}
      className="relative aspect-square w-full cursor-crosshair touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        // A picker graphic, not a theme color: white to the hue, then black from the bottom.
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex({ h: hsv.h, s: 1, v: 1 })})`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-xs border-2 border-white shadow-soft"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
      />
    </div>
  );
}
