import type { ReactNode } from "react";

/** Quiet mono text in a panel header: what the panel is about. */
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1 truncate font-mono text-xs font-normal text-subtle-foreground">
      {children}
    </span>
  );
}
