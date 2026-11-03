import type { ReactNode } from "react";
import { cn } from "@/ui";

interface TintPanelProps {
  /** The header row: title, tabs and actions. */
  header: ReactNode;
  className?: string;
  children: ReactNode;
}

/** One panel of the Tint page: a card floating on the table, with a header row. */
export function TintPanel({ header, className, children }: TintPanelProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md bg-surface shadow-[0_0_0_1px_var(--border)]",
        className,
      )}
    >
      <header className="flex h-[38px] shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap border-b border-border pr-2 pl-3.5 font-hand text-md font-bold">
        {header}
      </header>
      {children}
    </section>
  );
}
