import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` (white pencil) is the one main action of an area; `secondary` everything else; `mark` (red pencil) starts an export. */
  variant?: "primary" | "secondary" | "mark";
  size?: "sm" | "md";
}

const VARIANTS = {
  primary: "bg-foreground text-surface enabled:not-aria-disabled:hover:bg-ink-hover",
  secondary:
    "border-border-strong enabled:not-aria-disabled:hover:border-subtle-foreground enabled:not-aria-disabled:hover:bg-muted",
  mark: "bg-mark text-mark-foreground enabled:not-aria-disabled:hover:bg-mark-hover",
} as const;

const SIZES = {
  sm: "h-7 px-2.5 text-[13px] [&_svg]:size-3.5",
  md: "h-[30px] px-3 text-[13.5px] [&_svg]:size-4",
} as const;

/** A text button, optionally with a leading icon. */
export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center aria-disabled:cursor-default justify-center gap-1.5 rounded-[3px] border border-transparent font-hand font-bold transition-colors duration-150 ease-out disabled:cursor-default disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
