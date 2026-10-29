import { useState } from "react";
import { cn } from "../lib/cn";

interface NumberFieldProps {
  /** Accessible name. */
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Fires once, on Enter or blur, with a clamped number. */
  onChange(value: number): void;
  className?: string;
  /** Shown dimmed; nothing can be changed. */
  disabled?: boolean;
}

/** A compact number box that commits on Enter or blur and restores the value on bad input. */
export function NumberField({
  label,
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  unit,
  onChange,
  className,
  disabled,
}: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(String(value));
  }
  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed)) return setText(String(value));
    const next = Math.min(max, Math.max(min, parsed));
    setText(String(next));
    if (next !== value) onChange(next);
  };
  return (
    <label
      className={cn(
        "flex h-7 items-center gap-1 rounded-sm border border-border bg-surface-sunken px-2 focus-within:border-ring",
        disabled && "opacity-50",
        className,
      )}
    >
      <input
        aria-label={label}
        inputMode="decimal"
        disabled={disabled}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          else if (event.key === "Escape") setText(String(value));
          else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const delta = (event.key === "ArrowUp" ? 1 : -1) * step * (event.shiftKey ? 10 : 1);
            commit(String(Math.round((Number(text) + delta) / step) * step));
          }
        }}
        className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
      />
      {unit && <span className="text-2xs text-muted-foreground">{unit}</span>}
    </label>
  );
}
