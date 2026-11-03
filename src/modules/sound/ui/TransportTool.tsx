import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/ui";

interface TransportToolProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The tool in use: underlined in red pencil. */
  current?: boolean;
  /** A switch: on is drawn in `--on`. Leave unset for an action. */
  pressed?: boolean;
}

/** A pencilled word in the Sound page's transport row: a tool, a switch or an action. */
export function TransportTool({
  current = false,
  pressed,
  className,
  type = "button",
  ...props
}: TransportToolProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed ?? (current || undefined)}
      className={cn(
        "shrink-0 cursor-pointer whitespace-nowrap rounded-[3px] px-2 py-1.5 font-hand text-base font-bold leading-none text-muted-foreground hover:text-foreground",
        current && "rounded-none text-foreground shadow-[inset_0_-2px_0_var(--mark)]",
        pressed && "text-on hover:text-on",
        className,
      )}
      {...props}
    />
  );
}
