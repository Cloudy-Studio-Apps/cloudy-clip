import { useStore } from "zustand";
import type { ReactNode } from "react";
import { useModule } from "@/core";
import { inspectorRef } from "../inspector.ref";

interface InspectorSectionProps {
  title: string;
  /** Remembers whether it is folded; the title by default. */
  foldKey?: string;
  /** Drawn left of the title: a group's switch. The slot stays, so titles line up. */
  leading?: ReactNode;
  /** Drawn at the right of the band; clicking them doesn't fold. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** A band with a title that folds the fields under it, like DaVinci Resolve's inspector. */
export function InspectorSection({
  title,
  foldKey,
  leading,
  actions,
  children,
}: InspectorSectionProps) {
  const view = useModule(inspectorRef).view;
  const key = foldKey ?? title;
  const folded = useStore(view.store, (s) => s.folded.includes(key));
  const hasBody = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="border-b border-border">
      <div className="flex h-[30px] items-center gap-1.5 bg-muted px-2">
        <span className="grid w-7 shrink-0 place-items-center">{leading}</span>
        <button
          type="button"
          aria-expanded={!folded}
          className="h-full min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium"
          onClick={() => view.toggleFold(key)}
        >
          {title}
        </button>
        {actions}
      </div>
      {!folded && hasBody && (
        <div className="flex flex-col gap-1.5 px-2 pb-3 pt-2.5">{children}</div>
      )}
    </section>
  );
}
