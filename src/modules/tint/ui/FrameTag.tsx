import type { ReactNode } from "react";
import { cn } from "@/ui";

/** A small label in a corner of the frame: Before, After, Grades off. */
export function FrameTag({
  side,
  children,
}: {
  side: "left" | "right" | "center";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "absolute top-2 z-10 rounded-xs bg-surface-sunken/80 px-1.5 py-0.5 font-mono text-xs font-bold",
        side === "left" && "left-2",
        side === "right" && "right-2",
        side === "center" && "left-1/2 -translate-x-1/2 text-mark",
      )}
    >
      {children}
    </span>
  );
}
