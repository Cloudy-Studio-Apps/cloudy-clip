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
}: SliderFieldProps) {
  const range = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Follow the saved value whenever the user isn't dragging.
  useEffect(() => {
    if (!dragging.current && range.current) range.current.value = String(value);
  }, [value]);

  const show = (next: number) => {
    const input = box.current?.querySelector("input");
    if (input) input.value = String(next);
  };
  const finish = (next: number) => {
    if (!dragging.current) return;
    dragging.current = false;
    show(next);
    onCommit(next);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        ref={range}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        onPointerDown={() => {
          dragging.current = true;
        }}
        onChange={(event) => {
          const next = Number(event.target.value);
          show(next);
          onInput(next);
          // A keyboard nudge has no pointer press; commit it right away.
          if (!dragging.current) onCommit(next);
        }}
        onPointerUp={(event) => finish(Number(event.currentTarget.value))}
        onPointerCancel={(event) => finish(Number(event.currentTarget.value))}
        onBlur={(event) => finish(Number(event.currentTarget.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
      />
      <div ref={box} className="contents">
        <NumberField
          label={`${label} value`}
          value={value}
          min={min}
          max={max}
          step={step}
          unit={unit}
          onChange={(next) => {
            if (range.current) range.current.value = String(next);
            onInput(next);
            onCommit(next);
          }}
          className="w-16"
        />
      </div>
    </div>
  );
}
