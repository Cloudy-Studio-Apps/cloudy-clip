import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

interface LetterToggleProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onToggle"
> {
  on: boolean;
  /** Tooltip and accessible name. */
  label: string;
  /** How it looks while on: `mark` for mute and arm, `ink` for solo. */
  tone: "mark" | "ink";
  onToggle(): void;
  children: ReactNode;
}

/** A small lettered switch, as under a mixer strip's fader or on a track header: M, S, R, Read. */
export function LetterToggle({
  on,
  label,
  tone,
  onToggle,
  children,
  className,
  ...rest
}: LetterToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onToggle}
      {...rest}
      className={cn(
        "grid h-[18px] min-w-5 cursor-pointer place-items-center rounded-xs px-[3px] font-mono text-xs font-bold",
        !on &&
          "text-subtle-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:text-foreground",
        on && tone === "mark" && "bg-mark text-mark-foreground",
        on && tone === "ink" && "bg-foreground text-surface",
        className,
      )}
    >
      {children}
    </button>
  );
}
