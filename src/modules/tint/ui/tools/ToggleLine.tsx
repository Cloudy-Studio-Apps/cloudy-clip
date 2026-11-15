import { Switch } from "@/ui";
import { InfoTip } from "../InfoTip";

interface ToggleLineProps {
  label: string;
  onChange(checked: boolean): void;
  checked: boolean;
  disabled?: boolean;
  /** Shown in an ⓘ beside the label. */
  info?: string;
}

/** A label with a switch, as a slider row is laid out. */
export function ToggleLine({ label, onChange, checked, disabled, info }: ToggleLineProps) {
  return (
    <div className="flex h-7 items-center gap-2">
      <span className="min-w-[74px] shrink-0 text-base whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      {info && <InfoTip text={info} />}
      <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}
