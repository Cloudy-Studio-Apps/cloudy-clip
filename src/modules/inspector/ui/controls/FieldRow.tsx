import type { ReactNode } from "react";

/** A field's label on the left and its control filling the rest of the row. */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-16 shrink-0 truncate text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}
