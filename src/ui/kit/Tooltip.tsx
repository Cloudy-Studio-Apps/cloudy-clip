import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { Kbd } from "./Kbd";
import type { PanelAnchor, TipContent } from "./kit.types";

interface TooltipProps extends TipContent {
  /** What the thing is called. */
  name: string;
  /** The thing the pointer rests on. */
  children: ReactNode;
  className?: string;
}

const GAP = 6;

/**
 * A rich tooltip: the name, a sentence and the keys, in one floating layer on `document.body`.
 * It shows at once on hover or keyboard focus, below the thing, and flips above it near the
 * bottom of the window. Only the tip being shown exists, so there is never more than one.
 */
export function Tooltip({ name, text, keys, children, className }: TooltipProps) {
  const [from, setFrom] = useState<PanelAnchor | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    const box = anchor.current?.getBoundingClientRect();
    if (box) setFrom({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
  }, []);
  const hide = useCallback(() => setFrom(null), []);

  useLayoutEffect(() => {
    const box = layer.current;
    if (!from || !box) return;
    const { width, height } = box.getBoundingClientRect();
    const left = Math.max(GAP, Math.min(from.left, window.innerWidth - width - GAP));
    const below = from.bottom + GAP;
    const top = below + height > window.innerHeight - GAP ? from.top - height - GAP : below;
    box.style.left = `${left}px`;
    box.style.top = `${Math.max(GAP, top)}px`;
  }, [from]);

  return (
    <span
      ref={anchor}
      className={cn("inline-flex", className)}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {from &&
        createPortal(
          <div
            ref={layer}
            role="tooltip"
            className="pointer-events-none fixed top-0 left-0 z-[100] flex max-w-64 flex-col gap-0.5 rounded-sm bg-foreground px-2 py-1.5 text-background shadow-[0_0_0_1px_var(--border-strong)]"
          >
            <span className="flex items-center gap-2 font-hand text-sm font-bold">
              {name}
              {keys && <Kbd>{keys}</Kbd>}
            </span>
            {text && <span className="text-xs leading-snug opacity-80">{text}</span>}
          </div>,
          document.body,
        )}
    </span>
  );
}
