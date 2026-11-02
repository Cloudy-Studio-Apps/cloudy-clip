import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import type { MenuItem } from "./kit.types";

interface MenuListProps {
  items: readonly MenuItem[];
  /** Fires after an entry was picked, at any depth. */
  onClose(): void;
}

/** The entries of a menu. An entry with `items` opens a submenu to its right, on hover or click. */
export function MenuList({ items, onClose }: MenuListProps) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div role="menu" className="flex min-w-44 flex-col">
      {items.map((item, index) => {
        const nested = item.items !== undefined;
        const expanded = nested && open === item.label;
        const before = items[index - 1]?.group;
        const newGroup = before !== undefined && item.group !== before;
        return (
          <div
            key={item.label}
            className="relative"
            onPointerEnter={() => setOpen(nested ? item.label : null)}
          >
            {newGroup && <div className="mx-1 my-1 border-t border-dashed border-border-strong" />}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              aria-haspopup={nested ? "menu" : undefined}
              aria-expanded={nested ? expanded : undefined}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-xs px-2 py-1 text-left text-sm hover:bg-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent",
                item.destructive ? "text-destructive" : "text-foreground",
                expanded && "bg-hover",
              )}
              onClick={() => {
                if (nested) return setOpen(expanded ? null : item.label);
                onClose();
                item.onSelect?.();
              }}
            >
              {item.icon && (
                <item.icon
                  aria-hidden
                  className={cn("size-3.5 shrink-0", !item.destructive && "text-muted-foreground")}
                />
              )}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.shortcut && (
                <span className="ml-3 shrink-0 font-mono text-xs text-subtle-foreground">
                  {item.shortcut}
                </span>
              )}
              {nested && <ChevronRight aria-hidden className="size-3.5 shrink-0" />}
            </button>
            {expanded && (
              <div className="absolute left-full top-0 z-10 ml-1 rounded-sm border border-border-strong bg-popover p-1 shadow-popover">
                <MenuList items={item.items!} onClose={onClose} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
