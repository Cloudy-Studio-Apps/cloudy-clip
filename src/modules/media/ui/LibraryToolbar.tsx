import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { useStore } from "zustand";
import { ErrorBoundary, useModule, usePoint } from "@/core";
import { projectRef, type ProjectState } from "@/modules/project";
import { Button, IconButton, cn } from "@/ui";
import { libraryKinds } from "../media.points";
import { mediaRef } from "../media.ref";
import type { LibraryPlace } from "../media.types";
import { usePickMedia } from "./media.pick.hook";
import { SMART_BINS } from "./SmartBinList";

function pathOf(state: ProjectState, place: LibraryPlace): string[] {
  if (place.kind === "smart") return [];
  const names: string[] = [];
  for (let at = place.binId; at !== null; at = state.bins[at]?.parentId ?? null) {
    const bin = state.bins[at];
    if (!bin) break;
    names.unshift(bin.name);
  }
  return names;
}

/** Where you are, search, how to look at it, and what to add. */
export function LibraryToolbar() {
  const { view } = useModule(mediaRef);
  const place = useStore(view, (s) => s.place);
  const search = useStore(view, (s) => s.search);
  const layout = useStore(view, (s) => s.layout);
  const state = useStore(useModule(projectRef).store.api, (s) => s);
  const kinds = usePoint(libraryKinds);
  const pickMedia = usePickMedia();
  const smart =
    place.kind === "smart"
      ? (SMART_BINS.find(({ id }) => id === place.id)?.label ??
        kinds.find(({ type }) => type === place.id)?.label)
      : undefined;
  const crumb = smart ? ["Smart bins", smart] : ["Master", ...pathOf(state, place)];

  return (
    <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border-strong px-3">
      <div className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted-foreground">
        {crumb.map((name, index) => (
          <span key={index}>
            {index > 0 && " / "}
            {index === crumb.length - 1 ? <b className="text-foreground">{name}</b> : name}
          </span>
        ))}
      </div>
      <label className="flex h-7 min-w-0 flex-[0_1_190px] items-center gap-1.5 border-b-[1.5px] border-subtle-foreground px-0.5 text-subtle-foreground focus-within:border-ring">
        <Search aria-hidden className="size-3.5 shrink-0" />
        <input
          value={search}
          placeholder="Search this bin"
          aria-label="Search this bin"
          spellCheck={false}
          onChange={(event) => view.setState({ search: event.target.value })}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none"
        />
      </label>
      <div role="group" aria-label="View" className="flex gap-0.5">
        {(["grid", "list"] as const).map((mode) => (
          <IconButton
            key={mode}
            label={mode === "grid" ? "Thumbnails" : "List"}
            className={cn(
              layout === mode && "rounded-none text-foreground shadow-[inset_0_-2px_0_var(--mark)]",
            )}
            onClick={() => view.setState({ layout: mode })}
          >
            {mode === "grid" ? <LayoutGrid /> : <List />}
          </IconButton>
        ))}
      </div>
      {kinds.map(
        ({ type, CreateButton }) =>
          CreateButton && (
            <ErrorBoundary key={type} name={type}>
              <CreateButton />
            </ErrorBoundary>
          ),
      )}
      <Button variant="primary" size="sm" onClick={() => void pickMedia()}>
        <Plus />
        Import
      </Button>
    </div>
  );
}
