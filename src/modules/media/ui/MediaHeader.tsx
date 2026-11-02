import { Plus, Search } from "lucide-react";
import { useStore } from "zustand";
import { ErrorBoundary, useModule, usePoint } from "@/core";
import { Button } from "@/ui";
import { libraryKinds } from "../media.points";
import { mediaRef } from "../media.ref";
import { BinPicker } from "./BinPicker";
import { usePickMedia } from "./media.pick.hook";

/** The panel's top: search, what to add, and which bin it shows. */
export function MediaHeader() {
  const pickMedia = usePickMedia();
  const { view } = useModule(mediaRef);
  const search = useStore(view, (s) => s.search);
  const kinds = usePoint(libraryKinds);
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <label className="flex h-7 min-w-0 items-center gap-1.5 border-b-[1.5px] border-subtle-foreground px-0.5 text-subtle-foreground focus-within:border-ring">
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
      <div className="flex items-center justify-end gap-1.5">
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
      <BinPicker />
    </div>
  );
}
