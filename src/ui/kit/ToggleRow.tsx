import type { ReactNode } from "react";
import { Switch } from "./Switch";

interface ToggleRowProps {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
  /** Sub-fields, shown only while the toggle is on. */
  children?: ReactNode;
}

/** A labelled switch that reveals its sub-fields when on. */
export function ToggleRow({ label, checked, disabled, onChange, children }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">{label}</span>
        <Switch label={label} checked={checked} disabled={disabled} onChange={onChange} />
      </div>
      {checked && children && <div className="flex flex-col gap-2 pl-2">{children}</div>}
    </div>
  );
}
