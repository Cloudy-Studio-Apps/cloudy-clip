import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `primary` is the one main action of an area; `secondary` everything else. */
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
}

const VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border-border bg-surface-sunken hover:border-border-strong hover:bg-hover",
} as const;

const SIZES = {
  sm: "h-7 px-2.5 text-sm [&_svg]:size-3.5",
  md: "h-8 px-3.5 text-base [&_svg]:size-4",
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
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-transparent font-medium transition-colors duration-150 ease-out disabled:cursor-default disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
