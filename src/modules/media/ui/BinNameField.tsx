import { useRef } from "react";

interface BinNameFieldProps {
  depth: number;
  initial: string;
  /** The name, or null when it was cancelled or left empty. */
  onDone(name: string | null): void;
}

/** Names a bin in place, in the tree. Enter or leaving it confirms, Escape cancels. */
export function BinNameField({ depth, initial, onDone }: BinNameFieldProps) {
  const cancelled = useRef(false);
  return (
    <input
      autoFocus
      defaultValue={initial}
      aria-label="Bin name"
      spellCheck={false}
      style={{ marginLeft: 12 + depth * 16 }}
      className="h-7 min-w-0 flex-none border-b border-ring bg-transparent text-foreground outline-none"
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        else if (event.key === "Escape") {
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
      onBlur={(event) => onDone(cancelled.current ? null : event.target.value.trim() || null)}
    />
  );
}
