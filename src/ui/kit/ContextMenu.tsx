import { useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import type { MenuItem } from "./kit.types";

interface ContextMenuProps {
  items: readonly MenuItem[];
  /** The element that is right-clicked. */
  children: ReactElement;
}

/** A menu at the pointer, opened by a right click on its child. */
export function ContextMenu({ items, children }: ContextMenuProps) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!at) return;
    const onDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) setAt(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAt(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [at]);

  return (
    <>
      <div
        className="contents"
        onContextMenu={(event) => {
          event.preventDefault();
          setAt({ x: event.clientX, y: event.clientY });
        }}
      >
        {children}
      </div>
      {at &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            className="fixed z-50 min-w-40 rounded-md border border-border bg-popover p-1 shadow-popover"
            style={{ left: at.x, top: at.y }}
          >
            {items.map((item) => (
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
                  setAt(null);
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
