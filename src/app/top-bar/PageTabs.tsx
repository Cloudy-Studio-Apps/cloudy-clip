import { Fragment, useMemo } from "react";
import { useStore } from "zustand";
import {
  appPageGroups,
  appPages,
  groupPages,
  pagesRef,
  showPage,
  useKernel,
  useModule,
  usePoint,
} from "@/core";
import { cn } from "@/ui";

/**
 * A tab for every page modules contribute, in order, with a divider between groups. A tab is the
 * edge of the sheet below it, so the active one is taller and reaches over the 1px gap to join it.
 */
export function PageTabs() {
  const { bus } = useKernel();
  const pages = usePoint(appPages);
  const groups = usePoint(appPageGroups);
  const active = useStore(useModule(pagesRef).store, (state) => state.active);
  const grouped = useMemo(() => groupPages(pages, groups), [pages, groups]);
  return (
    <div role="tablist" aria-label="Page" className="flex items-end gap-[3px]">
      {grouped.flatMap((group, groupIndex) =>
        group.map(({ id, label, icon: Icon }, index) => (
          <Fragment key={id}>
            {groupIndex > 0 && index === 0 && (
              <span aria-hidden className="mx-1 mb-2 h-[18px] w-px bg-border-strong" />
            )}
            <button
              type="button"
              role="tab"
              aria-selected={id === active}
              className={cn(
                "inline-flex cursor-pointer items-center gap-[7px] rounded-t-sm pl-[13px] pr-4 font-hand text-md font-bold",
                id === active
                  ? "-mb-px h-[39px] bg-surface text-foreground shadow-[inset_0_2px_0_var(--mark)]"
                  : "h-[34px] bg-background text-muted-foreground hover:text-foreground",
              )}
              onClick={() => void bus.run(showPage, { page: id })}
            >
              {Icon && <Icon aria-hidden className="size-4" />}
              {label}
            </button>
          </Fragment>
        )),
      )}
    </div>
  );
}
