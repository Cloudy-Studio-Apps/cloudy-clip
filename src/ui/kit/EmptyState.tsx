import type { ReactNode } from "react";
import { SealMark } from "../brand/SealMark";
import { cn } from "../lib/cn";

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** The next step, usually one primary button. */
  action?: ReactNode;
  className?: string;
}

/** Shown where there is nothing yet: the seal keeps you company. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center border border-dashed border-border-strong px-3 py-6 text-center",
        className,
      )}
    >
      <SealMark rough className="mb-2 h-[72px] w-[86px] animate-bob" />
      <p className="font-hand text-md font-bold">{title}</p>
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
