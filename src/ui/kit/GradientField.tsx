import { Minus } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { Button } from "./Button";
import { ColorField } from "./ColorField";
import { barBackground, stopAt } from "./kit.gradient";
import { CHECKERBOARD } from "./kit.color";
import { NumberField } from "./NumberField";
import { SegmentedControl } from "./SegmentedControl";
import type { ColorChangeInfo, GradientValue, GradientValueStop } from "./kit.types";

const MAX_STOPS = 8;
const MIN_STOPS = 2;
const TYPES = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
] as const;

interface GradientFieldProps {
  label: string;
  value: GradientValue;
  onChange(value: GradientValue, info: ColorChangeInfo): void;
  recents?: readonly string[];
  swatches?: readonly string[];
  /** Shown dimmed; nothing can be changed. */
  disabled?: boolean;
}

const background = (stops: readonly GradientValueStop[]) =>
  `${barBackground(stops)}, ${CHECKERBOARD}`;

/**
 * A gradient: its type and angle, a bar of draggable stops (a click adds one) and the selected
 * stop's color. Dragging a stop moves the bar through the DOM, without re-rendering.
 */
export function GradientField({
  label,
  value,
  onChange,
  recents,
  swatches,
  disabled,
}: GradientFieldProps) {
  const [selected, setSelected] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const dragged = useRef<GradientValueStop[] | null>(null);
  const index = Math.min(selected, value.stops.length - 1);
  const stop = value.stops[index]!;
  const done = { done: true };

  const placeOnBar = (event: PointerEvent<HTMLElement>) => {
    const box = bar.current!.getBoundingClientRect();
    const at = (event.clientX - box.left) / Math.max(1, box.width);
    return Math.round(Math.min(1, Math.max(0, at)) * 1000) / 1000;
  };
  const withStop = (changes: Partial<GradientValueStop>) =>
    value.stops.map((s, i) => (i === index ? { ...s, ...changes } : s));

  const add = (event: PointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0 || value.stops.length >= MAX_STOPS) return;
    const stops = [...value.stops, stopAt(value.stops, placeOnBar(event))];
    setSelected(stops.length - 1);
    onChange({ ...value, stops }, done);
  };
  const remove = () => {
    onChange({ ...value, stops: value.stops.filter((_, i) => i !== index) }, done);
    setSelected(0);
  };

  const dragHandlers = (i: number) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      event.stopPropagation();
      if (disabled || event.button !== 0) return;
      setSelected(i);
      event.currentTarget.setPointerCapture(event.pointerId);
      dragged.current = value.stops;
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!dragged.current) return;
      const at = placeOnBar(event);
      const stops = dragged.current.map((s, n) => (n === i ? { ...s, at } : s));
      dragged.current = stops;
      event.currentTarget.style.left = `${at * 100}%`;
      bar.current!.style.background = background(stops);
      onChange({ ...value, stops }, { done: false });
    },
    onPointerUp() {
      const stops = dragged.current;
      dragged.current = null;
      if (stops && stops !== value.stops) onChange({ ...value, stops }, done);
    },
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label={`${label} type`}
          options={TYPES}
          value={value.type}
          disabled={disabled}
          onChange={(type) => onChange({ ...value, type }, done)}
        />
        {value.type === "linear" && (
          <NumberField
            label={`${label} angle`}
            value={value.angle}
            min={-3600}
            max={3600}
            unit="°"
            className="w-16"
            disabled={disabled}
            onInput={(angle) => onChange({ ...value, angle }, { done: false })}
            onChange={(angle) => onChange({ ...value, angle }, done)}
          />
        )}
      </div>
      <div
        ref={bar}
        role="group"
        aria-label={`${label} stops`}
        className="relative mx-1.5 h-5 cursor-copy shadow-[0_0_0_1px_var(--border-strong)]"
        style={{ background: background(value.stops) }}
        onPointerDown={add}
      >
        {value.stops.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Stop ${i + 1}`}
            aria-pressed={i === index}
            disabled={disabled}
            className="absolute inset-y-0 w-2.5 -translate-x-1/2 cursor-ew-resize rounded-xs border-2 border-foreground aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-ring"
            style={{ left: `${s.at * 100}%`, backgroundColor: s.color }}
            {...dragHandlers(i)}
          />
        ))}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <ColorField
          bare
          label={`${label} stop`}
          color={stop.color}
          opacity={stop.opacity}
          recents={recents}
          swatches={swatches}
          disabled={disabled}
          onChange={(color, opacity, info) =>
            onChange({ ...value, stops: withStop({ color, opacity }) }, info)
          }
        />
        <Button
          size="sm"
          aria-label="Remove stop"
          title="Remove stop"
          disabled={disabled || value.stops.length <= MIN_STOPS}
          onClick={remove}
        >
          <Minus />
        </Button>
      </div>
    </div>
  );
}
