import { useStore } from "zustand";
import { dismiss, notificationsStore } from "@/core";
import { cn } from "@/ui";

/** The colored edge that tells toasts apart at a glance. */
const LEVEL_STYLE = {
  info: "border-l-primary",
  success: "border-l-ice-300",
  error: "border-l-destructive",
} as const;

/** Transient toasts in the bottom-right corner. Click one to dismiss it. */
export function Notifications() {
  const items = useStore(notificationsStore, (s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {items.map((n) => (
        <button
          key={n.id}
          type="button"
          role="status"
          className={cn(
            "pointer-events-auto cursor-pointer rounded-sm border border-l-[3px] border-border bg-popover px-3 py-2 text-left text-sm text-foreground shadow-popover",
            LEVEL_STYLE[n.level],
          )}
          onClick={() => dismiss(n.id)}
        >
          {n.message}
        </button>
      ))}
    </div>
  );
}
