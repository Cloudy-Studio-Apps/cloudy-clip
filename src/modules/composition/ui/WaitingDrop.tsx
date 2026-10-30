import { useEffect } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { compositionRef } from "../composition.ref";

/** The chip while a dropped file is read. Escape cancels it. */
export function WaitingDrop() {
  const api = useModule(compositionRef);
  const waiting = useStore(api.ui, (s) => s.waiting);

  useEffect(() => {
    if (waiting === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") api.cancelWaiting();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [api, waiting]);

  if (waiting === null) return null;
  return (
    <p className="pointer-events-none absolute inset-x-0 top-8 z-[14] text-center text-xs">
      <span className="rounded-sm bg-primary-soft px-2 py-1 text-primary-soft-foreground">
        Reading {waiting}
      </span>
    </p>
  );
}
