import type { ReactNode } from "react";

interface PanelRowProps {
  label: string;
  /** What sits at the right: a value, a picker. Nothing for a label that heads a block. */
  children?: ReactNode;
}

/** A row of a panel card: the label at the left, `children` at the right. The one row layout. */
export function PanelRow({ label, children }: PanelRowProps) {
  return (
    <div className="flex min-h-[25px] items-center justify-between gap-2 text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  );
}
