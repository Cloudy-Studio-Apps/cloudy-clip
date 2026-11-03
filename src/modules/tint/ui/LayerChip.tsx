import { cn } from "@/ui";
import type { DemoChip } from "./demo/demo.types";

/** What a layer changes: the whole picture, picked colors, or a LUT. */
export function LayerChip({ chip }: { chip: DemoChip }) {
  return (
    <span
      className={cn(
        "rounded-xs px-1 font-mono text-2xs font-bold whitespace-nowrap",
        chip.kind === "whole" &&
          "text-muted-foreground shadow-[inset_0_0_0_1px_var(--border-strong)]",
        chip.kind === "key" && "text-primary shadow-[inset_0_0_0_1px_var(--primary)]",
        chip.kind === "lut" && "bg-accent-soft text-accent-soft-foreground",
      )}
    >
      {chip.label}
    </span>
  );
}
