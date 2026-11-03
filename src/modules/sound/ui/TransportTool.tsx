import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/ui";

interface TransportToolProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** A switch: on is drawn in `--on`. Leave unset for an action. */
  pressed?: boolean;
}

/** A pencilled word in the Sound page's transport row: a switch or an action. */
export function TransportTool({
  pressed,
  className,
  type = "button",
  ...props
}: TransportToolProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "shrink-0 cursor-pointer whitespace-nowrap rounded-[3px] px-2 py-1.5 font-hand text-base font-bold leading-none text-muted-foreground hover:text-foreground",
        pressed && "text-on hover:text-on",
        className,
      )}
      {...props}
    />
  );
}
