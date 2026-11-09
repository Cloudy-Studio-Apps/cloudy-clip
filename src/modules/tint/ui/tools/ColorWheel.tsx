import { RotateCcw } from "lucide-react";
import { useRef } from "react";
import type { Wheel } from "@/modules/project";
import { NumberField } from "@/ui";
import { PUCK_REACH, wheelColorNumbers, wheelWithChannel } from "../../logic/color/wheels";
import { CHANNEL_COLORS } from "./channel.colors";
import { JogBar } from "./JogBar";
import type { WheelEdit } from "./tools.types";
import { startWheelDrag } from "./wheel.gesture";

/** The hue ring of every wheel, as data colors (red at the top, clockwise). */
const RING =
  "radial-gradient(circle, var(--muted) 0 22%, transparent 70%), conic-gradient(hsl(0 75% 55%), hsl(60 75% 55%), hsl(120 75% 50%), hsl(180 75% 50%), hsl(240 75% 60%), hsl(300 75% 58%), hsl(360 75% 55%))";

/** Underline colors of the four numbers: master, red, green, blue. */
const NUMBER_COLORS = ["var(--muted-foreground)", ...CHANNEL_COLORS] as const;
const NUMBER_NAMES = ["Y", "R", "G", "B"] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The four numbers of a wheel: master, then the color part per channel. */
function numbersOf(wheel: Wheel): number[] {
  return [wheel.m, ...wheelColorNumbers(wheel)].map(round2);
}

const puckAt = (wheel: Wheel) => ({
  left: `${50 + wheel.x * PUCK_REACH * 50}%`,
  top: `${50 + wheel.y * PUCK_REACH * 50}%`,
});

interface ColorWheelProps {
  label: string;
  wheel: Wheel;
  /** Diameter in px. */
  size: number;
  /** One number (zone wheels) or the four of a primary wheel. */
  numbers?: "four" | "one";
  /** Makes the wheel real. Without it the wheel only shows its value. */
  edit?: WheelEdit;
}

/**
 * A color wheel: title with reset, the ring with its puck, its numbers and the master jog bar.
 * While the puck or the bar moves, the puck, the numbers and the live values follow in the DOM;
 * the value is saved once, on release.
 */
export function ColorWheel({ label, wheel, size, numbers = "four", edit }: ColorWheelProps) {
  const ring = useRef<HTMLSpanElement>(null);
  const puck = useRef<HTMLSpanElement>(null);
  const fields = useRef<HTMLSpanElement>(null);
  const shown = numbers === "four" ? [0, 1, 2, 3] : [0];
  const paint = (next: Wheel) => {
    const at = puckAt(next);
    if (puck.current) Object.assign(puck.current.style, at);
    const values = numbersOf(next);
    fields.current?.querySelectorAll("input").forEach((input, i) => {
      input.value = String(values[i]);
    });
  };
  const values = numbersOf(wheel);
  const finish = (next: Wheel | null) => {
    if (!edit) return;
    if (next === null) {
      paint(wheel);
      edit.cancel();
    } else if (next.x !== wheel.x || next.y !== wheel.y || next.m !== wheel.m) edit.commit(next);
    else edit.cancel();
  };
  const change = (index: number, value: number) => {
    if (!edit) return;
    if (index === 0) edit.commit({ ...wheel, m: value });
    else edit.commit(wheelWithChannel(wheel, (index - 1) as 0 | 1 | 2, value));
  };
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
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
      <span
        ref={ring}
        className={`relative block rounded-full shadow-[0_0_0_1px_var(--border-strong)] ${edit ? "cursor-crosshair touch-none" : ""}`}
        style={{ width: size, height: size, background: RING }}
        onPointerDown={(event) => {
          if (!edit || !ring.current) return;
          event.preventDefault();
          startWheelDrag({
            event: event.nativeEvent,
            ring: ring.current,
            wheel,
            onMove(next) {
              paint(next);
              edit.preview(next);
            },
            onEnd: finish,
          });
        }}
      >
        <span className="absolute inset-x-[20%] top-1/2 h-px bg-foreground/15" />
        <span className="absolute inset-y-[20%] left-1/2 w-px bg-foreground/15" />
        <span
          ref={puck}
          className="absolute size-3 -translate-1/2 rounded-full border-2 border-foreground bg-surface"
          style={puckAt(wheel)}
        />
      </span>
      <span ref={fields} className="flex gap-0.5">
        {shown.map((i) => (
          <span
            key={i}
            style={{ "--ch": NUMBER_COLORS[i] } as React.CSSProperties}
            className="[&_input]:text-center [&_input]:text-2xs [&_label]:h-5 [&_label]:w-[31px] [&_label]:border-b-2 [&_label]:border-(--ch)"
          >
            <NumberField
              label={`${label} ${NUMBER_NAMES[i]}`}
              value={values[i]!}
              min={-1}
              max={1}
              step={0.01}
              disabled={!edit}
              onChange={(value) => change(i, value)}
            />
          </span>
        ))}
      </span>
      <JogBar
        title={`${label} master: drag to brighten or darken`}
        width={size}
        value={wheel.m}
        disabled={!edit}
        onMove={(m) => {
          paint({ ...wheel, m });
          edit?.preview({ ...wheel, m });
        }}
        onEnd={(m) => (m === null ? (paint(wheel), edit?.cancel()) : finish({ ...wheel, m }))}
      />
    </div>
  );
}
