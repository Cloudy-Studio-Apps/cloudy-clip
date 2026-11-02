import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { ContextMenu, EmptyState } from "@/ui";
import { createBin } from "../media.bin.commands";
import { mediaRef } from "../media.ref";
import { NewBinTile } from "./BinTile";
import { FileInfoPanel } from "./FileInfoPanel";
import { useLibraryRows } from "./library.rows.hook";
import { LibraryRows } from "./LibraryRows";
import { LibrarySidebar } from "./LibrarySidebar";
import { LibraryToolbar } from "./LibraryToolbar";
import { DropOverlay } from "./MediaDrop";
import { MediaEmpty } from "./MediaEmpty";
import { usePickMedia } from "./media.pick.hook";
import { MediaViewer } from "./MediaViewer";

/** Find it on disk, sort it into bins, check it before you edit. */
export function MediaPage() {
  const { bus } = useKernel();
  const { view, fileDrop } = useModule(mediaRef);
  const pickMedia = usePickMedia();
  const [naming, setNaming] = useState(false);
  const rows = useLibraryRows();
  const search = useStore(view, (s) => s.search);
  const place = useStore(view, (s) => s.place);
  const dropActive = useStore(fileDrop, (s) => s.active);
  const master = place.kind === "bin" && place.binId === null;
  const parentId = place.kind === "bin" ? (place.binId ?? undefined) : undefined;
  const newBin = naming && (
    <NewBinTile
      onDone={(name) => {
        setNaming(false);
        if (name) void bus.run(createBin, { name, parentId });
      }}
    />
  );

  return (
    <div className="grid h-full grid-cols-[260px_minmax(0,1fr)_340px] bg-surface">
      <LibrarySidebar />
      <section className="relative flex min-h-0 min-w-0 flex-col">
        <LibraryToolbar />
        <ContextMenu
          items={[
            ...(place.kind === "bin"
              ? [{ label: "New bin", onSelect: () => setNaming(true) }]
              : []),
            { label: "Import media", onSelect: () => void pickMedia() },
          ]}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5">
            {rows.length > 0 || naming ? (
              <LibraryRows rows={rows} leading={newBin} />
            ) : search.trim() ? (
              <p className="my-10 text-center text-muted-foreground">
                Nothing matches that search.
              </p>
            ) : master ? (
              <MediaEmpty />
            ) : (
              <EmptyState title="Nothing in here yet">
                Drag files onto a bin, or import them while it's open.
              </EmptyState>
            )}
          </div>
        </ContextMenu>
        {dropActive && <DropOverlay />}
      </section>
      <aside className="flex min-h-0 flex-col border-l border-border-strong bg-surface">
        <MediaViewer />
        <FileInfoPanel />
      </aside>
    </div>
  );
}
