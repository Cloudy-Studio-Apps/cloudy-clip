import { ErrorBoundary, topBarItems, usePoint, type TopBarItem } from "@/core";
import { cn } from "@/ui";
import { Brand } from "./Brand";
import { HistoryControls } from "./HistoryControls";

/** The items of one slot; each fails on its own. */
function TopBarSlot({ items, slot }: { items: readonly TopBarItem[]; slot: TopBarItem["slot"] }) {
  return items
    .filter((item) => item.slot === slot)
    .map((item) => (
      <ErrorBoundary key={item.id} name={item.id}>
        <item.component />
      </ErrorBoundary>
    ));
}

/** The bar across the top: the brand on the left, undo/redo in the middle, modules' items. */
export function TopBar({ className }: { className?: string }) {
  const items = usePoint(topBarItems);
  return (
    <header
      className={cn("grid grid-cols-[1fr_auto_1fr] items-center bg-surface pl-3 pr-2", className)}
    >
      <div className="flex items-center gap-1">
        <Brand />
        <TopBarSlot items={items} slot="left" />
      </div>
      <div className="flex items-center gap-1">
        <HistoryControls />
        <TopBarSlot items={items} slot="center" />
      </div>
      <div className="flex items-center justify-end gap-2">
        <TopBarSlot items={items} slot="right" />
      </div>
    </header>
  );
}
