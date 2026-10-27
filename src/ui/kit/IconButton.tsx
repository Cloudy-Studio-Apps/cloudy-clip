import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Tooltip and accessible name. Include the shortcut, e.g. "Undo (Ctrl+Z)". */
  label: string;
  /** A toggle that is on (snapping, mute, …). */
  active?: boolean;
  /** `solid` is the big round-cornered play button of the transport. */
  variant?: "ghost" | "solid";
}

/** A square button that shows only an icon. */
export function IconButton({
  label,
  active,
  variant = "ghost",
  type = "button",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-grid shrink-0 cursor-pointer place-items-center rounded-sm transition-colors duration-150 ease-out disabled:cursor-default disabled:opacity-35",
        variant === "solid"
          ? "size-9 bg-foreground text-background hover:opacity-90 [&_svg]:size-4 [&_svg]:fill-current"
          : "size-7 text-muted-foreground hover:bg-hover hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-muted-foreground [&_svg]:size-4",
        active && "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft",
        className,
      )}
      {...props}
    />
  );
}
