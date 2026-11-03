import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  children: ReactNode;
}

/** A compact toolbar action: an icon and a short label ("Split", "Delete"). */
export function ToolbarButton({
  icon,
  children,
  type = "button",
  className,
  ...props
}: ToolbarButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center aria-disabled:cursor-default gap-1.5 whitespace-nowrap rounded-[3px] px-2 font-hand text-[13px] font-bold text-muted-foreground transition-colors duration-150 ease-out not-aria-disabled:hover:bg-hover not-aria-disabled:hover:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground [&_svg]:size-[15px]",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

/** A thin vertical line between groups of controls. */
export function ToolbarSeparator({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("mx-1.5 h-[18px] w-px shrink-0 bg-border-strong", className)} />
  );
}
