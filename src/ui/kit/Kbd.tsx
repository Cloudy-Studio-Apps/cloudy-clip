import type { ReactNode } from "react";

/** A keyboard key in running text, e.g. <Kbd>S</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-xs border border-border-strong bg-surface px-1 font-mono text-2xs text-foreground">
      {children}
    </kbd>
  );
}
