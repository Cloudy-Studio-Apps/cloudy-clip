import type { ReactNode } from "react";

interface ToolColumnsProps {
  children: ReactNode;
  /** Narrowest a column may be before the row wraps, in px. */
  min?: number;
  /** Space between columns, in px. */
  gap?: number;
}

/** Tool columns side by side, wrapping on narrow panels. */
export function ToolColumns({ children, min = 230, gap = 44 }: ToolColumnsProps) {
  return (
    <div
      className="grid max-w-[1180px] gap-y-5"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, columnGap: gap }}
    >
      {children}
    </div>
  );
}
