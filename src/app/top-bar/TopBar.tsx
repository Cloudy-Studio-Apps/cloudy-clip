import { cn } from "@/ui";
import { Brand } from "./Brand";
import { HistoryControls } from "./HistoryControls";

/** The bar across the top: the brand on the left, undo/redo in the middle. */
export function TopBar({ className }: { className?: string }) {
  return (
    <header
      className={cn("grid grid-cols-[1fr_auto_1fr] items-center bg-surface pl-3 pr-2", className)}
    >
      <div className="flex items-center gap-1">
        <Brand />
      </div>
      <div className="flex items-center gap-1">
        <HistoryControls />
      </div>
      <div className="flex items-center justify-end gap-2" />
    </header>
  );
}
