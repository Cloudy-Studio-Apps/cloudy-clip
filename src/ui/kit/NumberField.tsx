import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import { NumberScrub } from "./NumberScrub";

interface NumberFieldProps {
  /** Accessible name. */
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Fires once, on Enter, blur or the end of a scrub, with a clamped number. */
  onChange(value: number): void;
  /** Drawn first: a short name ("X") that can be dragged to change the number. */
  prefix?: string;
  /** Fires on every step of a scrub (live preview). */
  onInput?(value: number): void;
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
  prefix,
  onInput,
  className,
  disabled,
}: NumberFieldProps) {
  const input = useRef<HTMLInputElement>(null);
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
  const scrubBounds = { min, max, step };
  return (
    <label
      className={cn(
        "flex h-7 items-center gap-1 rounded-sm border border-border bg-surface-sunken px-2 focus-within:border-ring",
        disabled && "opacity-50",
        className,
      )}
    >
      {prefix !== undefined && !disabled && (
        <NumberScrub
          prefix={prefix}
          read={() => Number(input.current?.value ?? value)}
          bounds={scrubBounds}
          onStep={(next) => {
            if (input.current) input.current.value = String(next);
            onInput?.(next);
          }}
          onEnd={(next) => commit(String(next))}
        />
      )}
      {prefix !== undefined && disabled && (
        <span className="font-mono text-2xs text-muted-foreground">{prefix}</span>
      )}
      <input
        ref={input}
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
