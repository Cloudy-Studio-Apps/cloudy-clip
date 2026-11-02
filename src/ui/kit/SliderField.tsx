import { useEffect, useRef } from "react";
import { NumberField } from "./NumberField";

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Fires on every move of the thumb (live preview). */
  onInput(value: number): void;
  /** Fires once, on release or when a number is typed (one undo step). */
  onCommit(value: number): void;
  /** Shown dimmed; nothing can be changed. */
  disabled?: boolean;
  /** Leaves out the label, for a row that draws its own. */
  bare?: boolean;
  /** `log` spaces the line by ratios, for a value like speed, where 1 sits between 0.1 and 10. */
  scale?: "linear" | "log";
}

/**
 * A labelled range with a number box. Dragging calls `onInput` per move and `onCommit` once.
 * While dragging nothing re-renders: the range keeps its own value and the number box is written
 * straight to the DOM.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onInput,
  onCommit,
  disabled,
  bare,
  scale = "linear",
}: SliderFieldProps) {
  const log = scale === "log";
  const toLine = (next: number) => (log ? Math.log10(next) : next);
  const fromLine = (at: number) => (log ? Math.round(10 ** at * 100) / 100 : at);
  const range = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fill = (next: number) => {
    const share = (toLine(next) - toLine(min)) / (toLine(max) - toLine(min));
    range.current?.style.setProperty("--v", `${share * 100}%`);
  };

  // Follow the saved value whenever the user isn't dragging.
  useEffect(() => {
    if (dragging.current || !range.current) return;
    range.current.value = String(toLine(value));
    fill(value);
  });

  const show = (next: number) => {
    const input = box.current?.querySelector("input");
    if (input) input.value = String(next);
    fill(next);
  };
  const finish = (next: number) => {
    if (!dragging.current) return;
    dragging.current = false;
    show(next);
    onCommit(next);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {!bare && <span className="w-[74px] shrink-0 text-base text-muted-foreground">{label}</span>}
      <input
        ref={range}
        type="range"
        aria-label={label}
        min={toLine(min)}
        max={toLine(max)}
        step={log ? 0.001 : step}
        disabled={disabled}
        defaultValue={toLine(value)}
        onPointerDown={() => {
          dragging.current = true;
        }}
        onChange={(event) => {
          const next = fromLine(Number(event.target.value));
          show(next);
          onInput(next);
          // A keyboard nudge has no pointer press; commit it right away.
          if (!dragging.current) onCommit(next);
        }}
        onPointerUp={(event) => finish(fromLine(Number(event.currentTarget.value)))}
        onPointerCancel={(event) => finish(fromLine(Number(event.currentTarget.value)))}
        onBlur={(event) => finish(fromLine(Number(event.currentTarget.value)))}
        className="min-w-0 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-50"
      />
      <div ref={box} className="contents">
        <NumberField
          label={`${label} value`}
          value={value}
          min={min}
          max={max}
          step={step}
          unit={unit}
          disabled={disabled}
          onChange={(next) => {
            if (range.current) range.current.value = String(toLine(next));
            fill(next);
            onInput(next);
            onCommit(next);
          }}
          className="w-16"
        />
      </div>
    </div>
  );
}
