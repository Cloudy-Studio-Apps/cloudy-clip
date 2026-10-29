import type { ReactNode } from "react";
import { cn } from "../lib/cn";

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  /** Sub-fields, shown only while the toggle is on. */
  children?: ReactNode;
}

/** A labelled switch that reveals its sub-fields when on. */
export function ToggleRow({ label, checked, onChange, children }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-4 w-7 cursor-pointer rounded-sm border border-border transition-colors",
            checked ? "bg-primary" : "bg-surface-sunken",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-2.5 rounded-xs transition-all",
              checked ? "left-3.5 bg-primary-foreground" : "left-0.5 bg-muted-foreground",
            )}
          />
        </button>
      </div>
      {checked && children && <div className="flex flex-col gap-2 pl-2">{children}</div>}
    </div>
  );
}
