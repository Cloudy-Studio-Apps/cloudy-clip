import { RotateCcw } from "lucide-react";
import type { DemoWheel } from "../demo/demo.types";

/** The hue ring of every wheel, as data colors (red at the top, clockwise). */
const RING =
  "radial-gradient(circle, var(--muted) 0 22%, transparent 70%), conic-gradient(hsl(0 75% 55%), hsl(60 75% 55%), hsl(120 75% 50%), hsl(180 75% 50%), hsl(240 75% 60%), hsl(300 75% 58%), hsl(360 75% 55%))";

/** Underline colors of the four numbers: master, red, green, blue. */
const NUMBER_COLORS = ["var(--muted-foreground)", "#e0545a", "#4fbf6a", "#4d8fe0"] as const;

interface ColorWheelProps {
  wheel: DemoWheel;
  /** Diameter in px. */
  size: number;
  /** One number (zone wheels) or the four of a primary wheel. */
  numbers?: "four" | "one";
}

/** A color wheel: title with reset, the ring with its puck, its numbers and the master jog bar. */
export function ColorWheel({ wheel, size, numbers = "four" }: ColorWheelProps) {
  const shown = numbers === "four" ? wheel.numbers : wheel.numbers.slice(0, 1);
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <h5 className="flex items-center gap-1.5 font-hand text-base font-bold">
        {wheel.label}
        <button
          type="button"
          title={`Reset ${wheel.label}`}
          className="cursor-pointer text-subtle-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
        </button>
      </h5>
      <span
        className="relative block rounded-full shadow-[0_0_0_1px_var(--border-strong)]"
        style={{ width: size, height: size, background: RING }}
      >
        <span className="absolute inset-x-[20%] top-1/2 h-px bg-foreground/15" />
        <span className="absolute inset-y-[20%] left-1/2 w-px bg-foreground/15" />
        <span
          className="absolute size-3 -translate-1/2 rounded-full border-2 border-foreground bg-surface"
          style={{ left: `${50 + wheel.x * 40}%`, top: `${50 + wheel.y * 40}%` }}
        />
      </span>
      <span className="flex gap-0.5">
        {shown.map((n, i) => (
          <span
            key={i}
            className="min-w-[30px] rounded-xs bg-background px-0.5 text-center font-mono text-2xs"
            style={{ borderBottom: `2px solid ${NUMBER_COLORS[i]}` }}
          >
            {n.toFixed(2)}
          </span>
        ))}
      </span>
      <span
        title={`${wheel.label} master: drag to brighten or darken`}
        className="relative block h-3 rounded-xs bg-[repeating-linear-gradient(90deg,var(--border-strong)_0_1px,var(--surface-sunken)_1px_4px)]"
        style={{ width: size }}
      >
        <i className="absolute inset-y-0 left-1/2 block w-[3px] -translate-x-1/2 rounded-[1px] bg-foreground" />
      </span>
    </div>
  );
}
