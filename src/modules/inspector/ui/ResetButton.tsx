import { RotateCcw } from "lucide-react";
import { IconButton } from "@/ui";

interface ResetButtonProps {
  label: string;
  /** Greyed out while there is nothing to reset. */
  changed: boolean;
  onClick(): void;
}

/** The arrow at the end of a row or a section's band. */
export function ResetButton({ label, changed, onClick }: ResetButtonProps) {
  return (
    <IconButton
      label={label}
      disabled={!changed}
      className="!size-[18px] [&_svg]:!size-3"
      onClick={onClick}
    >
      <RotateCcw />
    </IconButton>
  );
}
