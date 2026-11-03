import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconButton, ToolbarButton } from "@/ui";
import { useTimelineScope } from "./scope.hook";

interface ToolbarActionProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "title"
> {
  icon: ReactNode;
  /** Tooltip, with the shortcut ("Split at playhead (S)"); the name on the sound scope too. */
  label: string;
  /** The word beside the icon on the editor's toolbar ("Split"). */
  children: ReactNode;
}

/**
 * An action of the timeline's toolbar: the icon and its word on the editor (`ToolbarButton`), the
 * icon alone with `label` as its tooltip on the sound scope (`IconButton`), as its sheet draws it.
 */
export function ToolbarAction({ icon, label, children, ...rest }: ToolbarActionProps) {
  const scope = useTimelineScope();
  if (scope === "sound") {
    return (
      <IconButton label={label} {...rest}>
        {icon}
      </IconButton>
    );
  }
  return (
    <ToolbarButton icon={icon} title={label} {...rest}>
      {children}
    </ToolbarButton>
  );
}
