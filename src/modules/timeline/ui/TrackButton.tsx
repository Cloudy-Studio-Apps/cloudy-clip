import type { ReactNode } from "react";
import { cn } from "@/ui";

interface TrackButtonProps {
  label: string;
  /** The track is muted or hidden: the button stands out so it's easy to spot. */
  off?: boolean;
  onClick(): void;
  children: ReactNode;
}

/** A small icon button in a track header. */
export function TrackButton({ label, off, onClick, children }: TrackButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={off}
      title={label}
      className={cn(
        "grid size-5 cursor-pointer place-items-center rounded-xs border border-transparent [&_svg]:size-3",
        off
          ? "bg-accent-soft text-accent-soft-foreground"
          : "text-muted-foreground hover:border-border-strong hover:text-foreground",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
