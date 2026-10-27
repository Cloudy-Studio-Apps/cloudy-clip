import type { ReactNode } from "react";
import { cn } from "@/ui";

interface LayoutRegionProps {
  /** Grid placement and the like, on the outer box. */
  className?: string;
  /** Layout of the content box (e.g. `flex`). */
  contentClassName?: string;
  /** A `ResizeHandle`, drawn over the edge (outside the clipped content box). */
  handle?: ReactNode;
  children: ReactNode;
}

/**
 * One area of the layout grid. The content is clipped; the resize handle is not, so its hit
 * area can straddle the 1px divider.
 */
export function LayoutRegion({ className, contentClassName, handle, children }: LayoutRegionProps) {
  return (
    <div className={cn("relative min-h-0 min-w-0 bg-surface", className)}>
      <div className={cn("h-full min-h-0 min-w-0 overflow-hidden", contentClassName)}>
        {children}
      </div>
      {handle}
    </div>
  );
}
