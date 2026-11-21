import { useStore } from "zustand";
import { useModule } from "@/core";
import { cn } from "@/ui";
import { subtitleRef } from "../subtitle.ref";
import { CueTab } from "./CueTab";
import { StyleTab } from "./StyleTab";

const TABS = [
  { id: "style", label: "Style" },
  { id: "cue", label: "Cue" },
] as const;

/** The Subtitles page's side panel: the Style and Cue tabs (`view.tab`). */
export function SubtitleSide() {
  const { view } = useModule(subtitleRef);
  const tab = useStore(view, (s) => s.tab);
  return (
    <aside className="flex min-h-0 min-w-0 flex-col">
      <nav
        role="tablist"
        className="flex h-[34px] shrink-0 items-end gap-0.5 border-b border-border-strong bg-muted px-3"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => view.setState({ tab: id })}
            className={cn(
              "h-[30px] w-[86px] cursor-pointer font-hand text-[13px] font-bold text-muted-foreground hover:text-foreground",
              tab === id && "text-foreground shadow-[inset_0_-2px_0_var(--mark)]",
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "style" ? <StyleTab /> : <CueTab />}
      </div>
    </aside>
  );
}
