import { useState } from "react";
import { Switch } from "@/ui";

interface ToggleLineProps {
  label: string;
  /** The starting state of a demo switch, which only flips on screen. */
  on?: boolean;
  /** Makes the switch real: it shows `checked` and calls this. */
  onChange?(checked: boolean): void;
  checked?: boolean;
  disabled?: boolean;
}

/** A label with a switch, as a slider row is laid out. Without `onChange` it only flips on screen. */
export function ToggleLine({ label, on = false, onChange, checked, disabled }: ToggleLineProps) {
  const [shown, setShown] = useState(on);
  return (
    <div className="flex h-7 items-center gap-2">
      <span className="min-w-[74px] shrink-0 text-base whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <Switch
        label={label}
        checked={onChange ? (checked ?? false) : shown}
        onChange={onChange ?? setShown}
        disabled={disabled}
      />
    </div>
  );
}
