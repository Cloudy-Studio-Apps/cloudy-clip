import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** The buttons along the bottom. */
  footer?: ReactNode;
}

/** A modal panel over a dim backdrop. Closes on Escape or a press outside it. */
export function Dialog({ title, onClose, children, footer }: DialogProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90vh] w-[360px] flex-col rounded-lg border border-border bg-popover shadow-popover"
      >
        <h2 className="border-b border-border px-3.5 py-2.5 text-sm font-semibold">{title}</h2>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3.5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-3.5 py-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
