import { Fragment } from "react";
import { cn } from "@/ui";
import { TOOLS } from "./tools/tools.registry";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

/** The tools as a column of icons; the open one is marked. Hover names it and says what it's for. */
export function ToolRail() {
  const tool = useTintView((v) => v.tool);
  const set = useTintSet();
  return (
    <nav
      aria-label="Tools"
      className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 overflow-auto border-r border-border bg-muted py-2"
    >
      {TOOLS.map((entry, i) => {
        const Icon = entry.icon;
        const on = entry.id === tool;
        return (
          <Fragment key={entry.id}>
            <button
              type="button"
              aria-pressed={on}
              title={`${entry.name}${entry.key ? ` (${entry.key})` : ""}: ${entry.tip}`}
              onClick={() => set({ tool: entry.id })}
              className={cn(
                "grid h-7 w-[38px] shrink-0 cursor-pointer place-items-center rounded-sm",
                on
                  ? "bg-surface text-foreground shadow-[inset_3px_0_0_var(--mark)]"
                  : "text-subtle-foreground hover:bg-hover hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
            {i === 0 && (
              <span
                aria-hidden
                className="my-1 w-[22px] border-t border-dashed border-border-strong"
              />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
