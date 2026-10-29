import { cn } from "../lib/cn";

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange(value: string): void;
  className?: string;
}

/** A native select styled as the other fields. */
export function SelectField({ label, value, options, onChange, className }: SelectFieldProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-7 min-w-0 cursor-pointer rounded-sm border border-border bg-surface-sunken px-2 text-xs text-foreground outline-none focus:border-ring",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
