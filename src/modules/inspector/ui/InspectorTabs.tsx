import { cn } from "@/ui";
import type { TabState } from "../inspector.types";

interface InspectorTabsProps {
  tabs: readonly TabState[];
  active: string | undefined;
  onPick(id: string): void;
}

/** The strip of icon tabs. What doesn't apply is greyed out, so tabs stay put between clips. */
export function InspectorTabs({ tabs, active, onPick }: InspectorTabsProps) {
  return (
    <nav role="tablist" className="flex shrink-0 border-b border-border-strong">
      {tabs.map(({ tab, available }) => {
        const Icon = tab.icon;
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={!available}
            className={cn(
              "flex h-[42px] min-w-0 flex-1 basis-0 cursor-pointer flex-col items-center justify-center gap-[3px] font-hand text-[13px] font-bold leading-none text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-35 disabled:hover:text-muted-foreground [&_svg]:size-4",
              on && "text-foreground shadow-[inset_0_-2px_0_var(--mark)]",
            )}
            onClick={() => onPick(tab.id)}
          >
            <Icon aria-hidden />
            <span className="max-w-full truncate">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
