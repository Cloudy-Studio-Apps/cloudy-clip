import { useState } from "react";
import { normalizeHex } from "../lib/color";
import { cn } from "../lib/cn";

interface HexInputProps {
  /** `#rrggbb`. */
  value: string;
  onChange(hex: string): void;
  className?: string;
}

/** A hex text box: commits a valid color on Enter or blur, otherwise restores the last one. */
export function HexInput({ value, onChange, className }: HexInputProps) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  const commit = () => {
    const hex = normalizeHex(text);
    if (hex) {
      setText(hex);
      if (hex !== value) onChange(hex);
    } else setText(value);
  };
  return (
    <input
      aria-label="Hex color"
      spellCheck={false}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") setText(value);
      }}
      className={cn(
        "h-7 min-w-0 rounded-sm border border-border bg-surface-sunken px-2 font-mono text-xs uppercase text-foreground outline-none focus:border-ring",
        className,
      )}
    />
  );
}
