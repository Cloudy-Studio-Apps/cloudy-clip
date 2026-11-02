import type { PanelIcon } from "@/core";
import { cn } from "@/ui";

interface TreeRowProps {
  icon: PanelIcon;
  label: string;
  count?: number;
  active: boolean;
  depth?: number;
  onClick(): void;
}

/** A line of the sidebar: icon, name, count. */
export function TreeRow({ icon: Icon, label, count, active, depth = 0, onClick }: TreeRowProps) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      style={{ paddingLeft: 12 + depth * 16 }}
      className={cn(
        "flex h-7 w-full shrink-0 cursor-pointer items-center gap-1.5 pr-3 text-left",
        active
          ? "bg-surface text-foreground shadow-[inset_2px_0_0_var(--mark)]"
          : "text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
      onClick={onClick}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <small className="font-mono text-[11.5px] text-subtle-foreground">{count}</small>
      )}
    </button>
  );
}
