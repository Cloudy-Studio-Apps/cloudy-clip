import type { ReactNode } from "react";

/** A setting: its name on the left, its control on the right. */
export function ExportRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-7 grid-cols-[33%_minmax(0,1fr)] items-center gap-2 text-sm text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  );
}
