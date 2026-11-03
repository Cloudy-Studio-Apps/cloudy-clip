import type { ReactNode } from "react";
import { cn } from "@/ui";

interface PanelCardProps {
  title: string;
  /** Drawn at the right of the title. */
  actions?: ReactNode;
  /** Its body at 40 % opacity: an effect that's off. The title and actions stay as they are. */
  dim?: boolean;
  className?: string;
  children: ReactNode;
}

/** A pencilled block of the panel under the timeline, between dashed rules. */
export function PanelCard({ title, actions, dim, className, children }: PanelCardProps) {
  return (
    <section
      className={cn(
        "min-w-0 border-b border-r border-dashed border-border-strong px-3 py-2.5",
        // The body only, through a selector: wrapping it would remount it when the switch flips.
        dim && "[&>:not(h4)]:opacity-40",
        className,
      )}
    >
      <h4 className="mb-1.5 flex items-center justify-between gap-2 font-hand text-md font-bold">
        {title}
        {actions}
      </h4>
      {children}
    </section>
  );
}
