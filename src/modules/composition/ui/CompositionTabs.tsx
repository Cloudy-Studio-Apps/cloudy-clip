import { X } from "lucide-react";
import { useStore } from "zustand";
import { LOCAL_ACTOR, useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { cn } from "@/ui";
import { closeTab, openComposition } from "../composition.commands";

/** The open compositions, above the timeline. */
export function CompositionTabs() {
  const { bus } = useKernel();
  const { store, view } = useModule(projectRef);
  const tabs = useStore(view.store, (s) => s.tabs);
  const open = useStore(view.store, (s) => s.open[LOCAL_ACTOR]);
  const compositions = useStore(store.api, (s) => s.compositions);
  const main = useStore(store.api, (s) => s.mainCompositionId);
  const current = open === undefined ? main : open;
  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border px-1 pt-1"
    >
      {tabs.map((id) => (
        <div
          key={id}
          data-collab-target={`composition:${id}`}
          className={cn(
            "group flex max-w-44 items-center rounded-t-sm text-xs",
            id === current
              ? "bg-primary text-primary-foreground"
              : "bg-surface-sunken text-muted-foreground hover:text-foreground",
          )}
        >
          <button
            type="button"
            role="tab"
            aria-selected={id === current}
            className="min-w-0 cursor-pointer truncate py-1 pl-2"
            onClick={() => void bus.run(openComposition, { compositionId: id })}
          >
            {compositions[id]?.name}
          </button>
          <button
            type="button"
            aria-label={`Close ${compositions[id]?.name ?? "tab"}`}
            className="grid size-5 cursor-pointer place-items-center opacity-60 hover:opacity-100"
            onClick={() => void bus.run(closeTab, { compositionId: id })}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
