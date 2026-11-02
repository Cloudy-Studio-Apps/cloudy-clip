import { Fragment } from "react";
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
      className={cn("inline-flex h-7 items-stretch gap-3.5", disabled && "opacity-50", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Fragment key={option.value}>
            {option.divided && <span aria-hidden className="my-1 w-px bg-border-strong" />}
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              title={option.hint}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap font-hand text-[13px] font-bold disabled:cursor-default",
                selected
                  ? "text-foreground shadow-[inset_0_-2px_0_var(--mark)]"
                  : "text-muted-foreground enabled:hover:text-foreground",
              )}
              onClick={() => onChange(option.value)}
            >
              {option.icon && <option.icon className="size-3.5" />}
              {option.label}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
