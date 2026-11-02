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
        "relative h-4 w-[30px] shrink-0 cursor-pointer rounded-lg transition-colors duration-100 disabled:cursor-default disabled:opacity-50",
        checked ? "bg-on" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-3 rounded-full bg-foreground transition-transform duration-100 ease-out",
          checked && "translate-x-3.5",
        )}
      />
    </button>
  );
}
