import type { ReactNode } from "react";
import { cn } from "@/ui";

interface StripToggleProps {
  on: boolean;
  /** Tooltip and accessible name. */
  label: string;
  /** How it looks while on: `mark` for mute, `ink` for solo. */
  tone: "mark" | "ink";
  onToggle(): void;
  children: ReactNode;
}

/** A small lettered switch under a strip's fader: M (mute) or S (solo). */
export function StripToggle({ on, label, tone, onToggle, children }: StripToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-[18px] min-w-5 cursor-pointer place-items-center rounded-xs px-[3px] font-mono text-xs font-bold",
        !on &&
          "text-subtle-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:text-foreground",
        on && tone === "mark" && "bg-mark text-mark-foreground",
        on && tone === "ink" && "bg-foreground text-surface",
      )}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}
