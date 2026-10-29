import { cn } from "../lib/cn";
import type { SegmentedOption } from "./kit.types";

interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T | undefined;
  onChange(value: T): void;
  className?: string;
  /** Shown dimmed; nothing can be changed. */
  disabled?: boolean;
}

/** A row of mutually exclusive choices, e.g. the preview's aspect ratio. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex h-7 rounded-sm border border-border bg-surface-sunken p-0.5",
        disabled && "opacity-50",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={option.hint}
            className={cn(
              "min-w-10 cursor-pointer rounded-xs px-2 font-mono text-xs disabled:cursor-default",
              selected
                ? "bg-muted text-foreground shadow-soft"
                : "text-muted-foreground enabled:hover:text-foreground",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
