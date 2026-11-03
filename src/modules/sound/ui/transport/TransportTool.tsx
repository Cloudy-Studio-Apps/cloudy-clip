import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/ui";

interface TransportToolProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** A switch: on is drawn in `--on`. Leave unset for an action. */
  pressed?: boolean;
  /** The pointer tool in use: drawn in `--foreground`, underlined in `--mark`. */
  current?: boolean;
}

/** A pencilled word in the Sound page's transport row: a switch, an action or a pointer tool. */
export function TransportTool({
  pressed,
  current,
  className,
  type = "button",
  ...props
}: TransportToolProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      aria-current={current || undefined}
      className={cn(
        "shrink-0 cursor-pointer whitespace-nowrap aria-disabled:cursor-default px-2 py-1.5 font-hand text-base font-bold leading-none",
        // One colour and one corner each, so no two utilities fight over them.
        current
          ? "rounded-none text-foreground shadow-[inset_0_-2px_0_var(--mark)]"
          : pressed
            ? "rounded-xs text-on"
            : "rounded-xs text-muted-foreground not-aria-disabled:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
