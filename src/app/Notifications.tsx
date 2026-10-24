import { useStore } from "zustand";
import { dismiss, notificationsStore } from "@/core";

const LEVEL_STYLE = {
  info: "border-sky-700 bg-sky-950/95 text-sky-100",
  success: "border-emerald-700 bg-emerald-950/95 text-emerald-100",
  error: "border-red-700 bg-red-950/95 text-red-100",
} as const;

/** Transient toasts in the bottom-right corner. */
export function Notifications() {
  const items = useStore(notificationsStore, (s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {items.map((n) => (
        <button
          key={n.id}
          type="button"
          role="status"
          className={`pointer-events-auto rounded-md border px-3 py-2 text-left text-xs shadow-lg ${LEVEL_STYLE[n.level]}`}
          onClick={() => dismiss(n.id)}
        >
          {n.message}
        </button>
      ))}
    </div>
  );
}
