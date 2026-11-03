import type { ReactNode } from "react";
import { InfoTip } from "../InfoTip";

interface ToolColumnProps {
  title: string;
  /** Shown in an ⓘ beside the title. */
  info?: string;
  children: ReactNode;
}

/** A titled column of a tool, with a dashed rule under its title. */
export function ToolColumn({ title, info, children }: ToolColumnProps) {
  return (
    <div className="min-w-0">
      <h5 className="mb-3 flex items-center gap-1.5 border-b border-dashed border-border-strong pb-1.5 font-hand text-sm font-bold text-muted-foreground">
        {title}
        {info && <InfoTip text={info} />}
      </h5>
      {children}
    </div>
  );
}
