import type { LayoutPanel } from "@/core";
import { cn } from "@/ui";

interface SideRailProps {
  panels: readonly LayoutPanel[];
  activeId: string | undefined;
  onSelect(id: string): void;
}

/** The tool rail: one tab per side panel (Media, and later Audio, Text, …). */
export function SideRail({ panels, activeId, onSelect }: SideRailProps) {
  return (
    <nav
      aria-label="Panels"
      className="flex w-16 shrink-0 flex-col gap-0.5 border-r border-border bg-surface-sunken px-1 py-1.5"
    >
      {panels.map(({ id, title, icon: Icon }) => {
        const active = id === activeId;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex cursor-pointer flex-col items-center gap-1 rounded-sm pb-1.5 pt-2 text-2xs font-medium",
              active
                ? "bg-primary-soft text-primary-soft-foreground before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:bg-primary"
                : "text-muted-foreground hover:bg-hover hover:text-foreground",
            )}
            onClick={() => onSelect(id)}
          >
            {Icon && <Icon className="size-[18px]" />}
            {title}
          </button>
        );
      })}
    </nav>
  );
}
