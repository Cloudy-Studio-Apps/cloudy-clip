import { ErrorBoundary, topBarItems, usePoint, type TopBarItem } from "@/core";
import { cn } from "@/ui";
import { Brand } from "./Brand";
import { HistoryControls } from "./HistoryControls";
import { PageTabs } from "./PageTabs";

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

/** The bar across the top: the brand on the left, the page tabs in the middle, undo/redo and modules' items on the right. */
export function TopBar({ className }: { className?: string }) {
  const items = usePoint(topBarItems);
  return (
    <header
      className={cn(
        "relative z-[35] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 bg-surface-sunken px-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1 self-center">
        <Brand />
        <TopBarSlot items={items} slot="left" />
      </div>
      <div className="flex items-end gap-2">
        <PageTabs />
        <div className="flex items-center self-center empty:hidden">
          <TopBarSlot items={items} slot="center" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 self-center">
        <HistoryControls />
        <TopBarSlot items={items} slot="right" />
      </div>
    </header>
  );
}
