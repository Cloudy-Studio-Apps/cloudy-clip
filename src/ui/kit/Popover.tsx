import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  /** The element that opens it; it receives the click handler and aria props. */
  trigger: ReactElement;
  open?: boolean;
  onOpenChange?(open: boolean): void;
  /** Where it opens relative to the trigger. Default `bottom`. */
  side?: "bottom" | "left" | "right";
  children: ReactNode;
}

const GAP = 6;

/**
 * A floating panel anchored to a trigger. It renders in `document.body`, closes on an outside
 * pointer press or Escape, and returns focus to the trigger. Controlled with `open`, or on its own.
 */
export function Popover({ trigger, open, onOpenChange, side = "bottom", children }: PopoverProps) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (next: boolean) => {
      setInner(next);
      onOpenChange?.(next);
      if (!next) anchor.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
    },
    [onOpenChange],
  );

  useLayoutEffect(() => {
    const box = panel.current;
    const from = anchor.current?.getBoundingClientRect();
    if (!isOpen || !box || !from) return;
    const { width, height } = box.getBoundingClientRect();
    let left =
      side === "left" ? from.left - width - GAP : side === "right" ? from.right + GAP : from.left;
    let top = side === "bottom" ? from.bottom + GAP : from.top;
    left = Math.max(GAP, Math.min(left, window.innerWidth - width - GAP));
    if (top + height > window.innerHeight - GAP) {
      top = side === "bottom" ? from.top - height - GAP : window.innerHeight - height - GAP;
    }
    box.style.left = `${left}px`;
    box.style.top = `${Math.max(GAP, top)}px`;
  }, [isOpen, side]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, setOpen]);

  return (
    <>
      <span
        ref={anchor}
        className="inline-flex"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        {trigger}
      </span>
      {isOpen &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            className="fixed z-50 rounded-md border border-border bg-popover p-2 text-foreground shadow-popover"
            style={{ left: 0, top: 0 }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
