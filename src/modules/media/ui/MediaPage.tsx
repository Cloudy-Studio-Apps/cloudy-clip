import { useStore } from "zustand";
import { useModule } from "@/core";
import { EmptyState } from "@/ui";
import { mediaRef } from "../media.ref";
import { FileInfoPanel } from "./FileInfoPanel";
import { useLibraryRows } from "./library.rows.hook";
import { LibraryRows } from "./LibraryRows";
import { LibrarySidebar } from "./LibrarySidebar";
import { LibraryToolbar } from "./LibraryToolbar";
import { DropOverlay } from "./MediaDrop";
import { MediaEmpty } from "./MediaEmpty";
import { MediaViewer } from "./MediaViewer";

/** Find it on disk, sort it into bins, check it before you edit. */
export function MediaPage() {
  const { view, fileDrop } = useModule(mediaRef);
  const rows = useLibraryRows();
  const search = useStore(view, (s) => s.search);
  const place = useStore(view, (s) => s.place);
  const dropActive = useStore(fileDrop, (s) => s.active);
  const master = place.kind === "bin" && place.binId === null;

  return (
    <div className="grid h-full grid-cols-[260px_minmax(0,1fr)_340px] bg-surface">
      <LibrarySidebar />
      <section className="relative flex min-h-0 min-w-0 flex-col">
        <LibraryToolbar />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5">
          {rows.length > 0 ? (
            <LibraryRows rows={rows} />
          ) : search.trim() ? (
            <p className="my-10 text-center text-muted-foreground">Nothing matches that search.</p>
          ) : master ? (
            <MediaEmpty />
          ) : (
            <EmptyState title="Nothing in here yet">
              Drag files onto a bin, or import them while it's open.
            </EmptyState>
          )}
        </div>
        {dropActive && <DropOverlay />}
      </section>
      <aside className="flex min-h-0 flex-col border-l border-border-strong bg-surface">
        <MediaViewer />
        <FileInfoPanel />
      </aside>
    </div>
  );
}
