import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PanelAnchor } from "./kit.types";

interface FloatingPanelProps {
  /** Accessible name. */
  label: string;
  /** The box it sits above; null closes it. */
  anchor(): PanelAnchor | null;
  /** Calls the listener when the box may have moved. Returns the unsubscribe. */
  follow?(listener: () => void): () => void;
  onClose(): void;
  children: ReactNode;
}

const GAP = 8;

/** A panel above a box on screen. It closes on an outside press or Escape, and stays in the window. */
export function FloatingPanel({ label, anchor, follow, onClose, children }: FloatingPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef({ anchor, onClose });

  useLayoutEffect(() => {
    latest.current = { anchor, onClose };
  });

  useLayoutEffect(() => {
    const place = () => {
      const box = panel.current;
      const to = latest.current.anchor();
      if (!box) return;
      if (!to) return latest.current.onClose();
      const { width, height } = box.getBoundingClientRect();
      const middle = (to.left + to.right) / 2 - width / 2;
      box.style.left = `${Math.max(GAP, Math.min(middle, window.innerWidth - width - GAP))}px`;
      box.style.top = `${Math.max(GAP, to.top - height - GAP)}px`;
    };
    place();
    return follow?.(place);
  }, [follow]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) latest.current.onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current.onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      className="fixed z-50 rounded-sm border border-border-strong bg-popover p-2.5 text-foreground shadow-popover"
      style={{ left: 0, top: 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}
