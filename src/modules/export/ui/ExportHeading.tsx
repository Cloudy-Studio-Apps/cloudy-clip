import type { ReactNode } from "react";

/** The small title of a group of settings. */
export function ExportHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
      {children}
    </h2>
  );
}
