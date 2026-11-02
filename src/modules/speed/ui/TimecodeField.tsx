import { useEffect, useRef } from "react";
import { formatTimecode, type Micros } from "@/core";
import { parseTimecode } from "../logic/timecode";

interface TimecodeFieldProps {
  label: string;
  value: Micros;
  disabled?: boolean;
  onCommit(value: Micros): void;
}

/** A length as a timecode to type over. Text that isn't one goes back to the value. */
export function TimecodeField({ label, value, disabled, onCommit }: TimecodeFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const shown = formatTimecode(value);

  useEffect(() => {
    if (input.current) input.current.value = shown;
  }, [shown]);

  const commit = () => {
    const box = input.current;
    if (!box) return;
    const typed = parseTimecode(box.value);
    if (typed === null || box.value === shown) box.value = shown;
    else onCommit(typed);
  };

  return (
    <label className="flex h-7 min-w-0 flex-1 items-center border-b border-border-strong px-0.5 focus-within:border-ring">
      <input
        ref={input}
        aria-label={label}
        defaultValue={shown}
        disabled={disabled}
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-right font-mono text-[13px] font-bold text-foreground outline-none disabled:opacity-50"
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
