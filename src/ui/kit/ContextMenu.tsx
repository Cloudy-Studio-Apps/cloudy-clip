import { useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import type { MenuItem } from "./kit.types";

interface ContextMenuProps {
  /** A list, or a function asked when the menu opens. */
  items: readonly MenuItem[] | (() => readonly MenuItem[]);
  /** The element that is right-clicked. */
  children: ReactElement;
}

/** A menu at the pointer, opened by a right click on its child. */
export function ContextMenu({ items, children }: ContextMenuProps) {
  const [open, setOpen] = useState<{ x: number; y: number; items: readonly MenuItem[] } | null>(
    null,
  );
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div
        className="contents"
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const shown = typeof items === "function" ? items() : items;
          if (shown.length > 0) setOpen({ x: event.clientX, y: event.clientY, items: shown });
        }}
      >
        {children}
      </div>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            className="fixed z-50 min-w-40 rounded-md border border-border bg-popover p-1 shadow-popover"
            style={{ left: open.x, top: open.y }}
          >
            {open.items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  "block w-full cursor-pointer rounded-xs px-2 py-1 text-left text-xs hover:bg-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent",
                  item.destructive ? "text-destructive" : "text-foreground",
                )}
                onClick={() => {
                  setOpen(null);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
