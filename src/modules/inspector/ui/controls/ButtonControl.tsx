import { Button } from "@/ui";
import type { CommandControlProps } from "../../inspector.types";
import { ControlIcon } from "./ControlIcon";

/** A button that runs its command on the clip. */
export function ButtonControl({ label, icon, run }: CommandControlProps) {
  return (
    <Button size="sm" className="self-start" onClick={() => run({})}>
      <ControlIcon name={icon} />
      {label}
    </Button>
  );
}
