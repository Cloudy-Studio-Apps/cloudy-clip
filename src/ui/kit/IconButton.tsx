import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Tooltip and accessible name. Include the shortcut, e.g. "Undo (Ctrl+Z)". */
  label: string;
  /** A toggle that is on (snapping, mute, …). */
  active?: boolean;
  /** `solid` is the big round-cornered play button of the transport. */
  variant?: "ghost" | "solid";
  /**
   * A ghost button's colour instead of the muted one, kept on hover: `mark` (record), `on` (a
   * switch that is on, drawn in `--on` with no fill), `mark-filled` (filled `--mark`: recording).
   */
  tone?: "mark" | "on" | "mark-filled";
  /** Disabled while something runs (a take starting or saving): not dimmed, so it still reads. */
  busy?: boolean;
}

/** A ghost button's colours, one set per look, so no two utilities fight over a property. */
function ghostLook(active: boolean | undefined, tone: IconButtonProps["tone"]): string {
  if (active)
    return "bg-primary-soft text-primary-soft-foreground not-aria-disabled:hover:bg-primary-soft not-aria-disabled:hover:text-foreground";
  switch (tone) {
    case "mark":
      return "text-mark not-aria-disabled:hover:bg-hover disabled:hover:bg-transparent";
    case "on":
      return "text-on not-aria-disabled:hover:bg-hover disabled:hover:bg-transparent";
    case "mark-filled":
      return "bg-mark text-mark-foreground not-aria-disabled:hover:bg-mark-hover";
    default:
      return "text-muted-foreground not-aria-disabled:hover:bg-hover not-aria-disabled:hover:text-foreground disabled:hover:bg-transparent disabled:hover:text-muted-foreground";
  }
}

/** A square button that shows only an icon. */
export function IconButton({
  label,
  active,
  variant = "ghost",
  tone,
  busy = false,
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
      aria-busy={busy || undefined}
      className={cn(
        "inline-grid shrink-0 cursor-pointer place-items-center aria-disabled:cursor-default rounded-[3px] transition-colors duration-150 ease-out disabled:cursor-default",
        !busy && "disabled:opacity-35",
        variant === "solid"
          ? "size-9 bg-foreground text-background not-aria-disabled:hover:opacity-90 [&_svg]:size-4 [&_svg]:fill-current"
          : cn("size-[30px] [&_svg]:size-4", ghostLook(active, tone)),
        className,
      )}
      {...props}
    />
  );
}
