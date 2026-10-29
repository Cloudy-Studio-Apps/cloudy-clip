import { useState } from "react";
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

/** A labelled range with a number box. Dragging calls `onInput` per move and `onCommit` once. */
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
  const [live, setLive] = useState(value);
  const [dragging, setDragging] = useState(false);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    if (!dragging) setLive(value);
  }

  const finish = (next: number) => {
    if (!dragging) return;
    setDragging(false);
    onCommit(next);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={live}
        onPointerDown={() => setDragging(true)}
        onChange={(event) => {
          const next = Number(event.target.value);
          setLive(next);
          // A keyboard nudge has no pointer press; commit it right away.
          if (dragging) onInput(next);
          else {
            onInput(next);
            onCommit(next);
          }
        }}
        onPointerUp={(event) => finish(Number(event.currentTarget.value))}
        onPointerCancel={(event) => finish(Number(event.currentTarget.value))}
        onBlur={(event) => finish(Number(event.currentTarget.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
      />
      <NumberField
        label={`${label} value`}
        value={live}
        min={min}
        max={max}
        step={step}
        unit={unit}
        onChange={(next) => {
          setLive(next);
          onInput(next);
          onCommit(next);
        }}
        className="w-16"
      />
    </div>
  );
}
