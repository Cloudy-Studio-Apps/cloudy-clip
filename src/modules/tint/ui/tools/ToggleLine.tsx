import { useState } from "react";
import { Switch } from "@/ui";

/** A label with a switch, as a slider row is laid out. The switch only flips on screen. */
export function ToggleLine({ label, on = false }: { label: string; on?: boolean }) {
  const [checked, setChecked] = useState(on);
  return (
    <div className="flex h-7 items-center gap-2">
      <span className="min-w-[74px] shrink-0 text-base whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <Switch label={label} checked={checked} onChange={setChecked} />
    </div>
  );
}
