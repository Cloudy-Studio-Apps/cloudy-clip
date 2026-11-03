import type { ReactNode } from "react";

/** Where the picture comes in and goes out of the layer list, on a dashed rule. */
export function FlowLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1 font-mono text-2xs font-bold tracking-wide text-subtle-foreground uppercase after:flex-1 after:border-t after:border-dashed after:border-border-strong">
      {children}
    </div>
  );
}
