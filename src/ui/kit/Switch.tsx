import { cn } from "../lib/cn";

interface SwitchProps {
  /** Accessible name. */
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
}

/** A small on/off switch. */
export function Switch({ label, checked, disabled, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-4 w-7 shrink-0 cursor-pointer rounded-sm border border-border transition-colors disabled:cursor-default disabled:opacity-50",
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
  );
}
