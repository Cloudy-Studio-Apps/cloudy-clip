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
      className="flex w-[78px] shrink-0 flex-col gap-0.5 border-r border-border-strong bg-muted pt-2"
    >
      {panels.map(({ id, title, icon: Icon }) => {
        const active = id === activeId;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            data-collab-target={`panel:${id}`}
            className={cn(
              "relative flex h-14 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 font-hand text-[11.5px] font-bold leading-none",
              active
                ? "-mr-px bg-surface text-foreground shadow-[inset_2px_0_0_var(--mark)]"
                : "text-muted-foreground hover:text-foreground",
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
