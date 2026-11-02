import { useStore } from "zustand";
import { ErrorBoundary, useModule, usePoint } from "@/core";
import { projectRef } from "@/modules/project";
import { librarySections } from "../media.points";
import { mediaRef } from "../media.ref";
import { useLibraryRows } from "./library.rows.hook";
import { LibraryRows } from "./LibraryRows";
import { DropHint, DropOverlay } from "./MediaDrop";
import { MediaEmpty } from "./MediaEmpty";
import { MediaHeader } from "./MediaHeader";

/** The Media tab: compositions and the open bin, dragged from here onto the timeline. */
export function MediaLibrary() {
  const project = useModule(projectRef).store;
  const empty = useStore(
    project.api,
    (s) => s.mediaOrder.length === 0 && s.solidOrder.length === 0,
  );
  const dropActive = useStore(useModule(mediaRef).fileDrop, (s) => s.active);
  const sections = usePoint(librarySections);
  const rows = useLibraryRows();

  return (
    <section className="relative flex h-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-2.5">
      {sections.map(({ id, component: Section }) => (
        <ErrorBoundary key={id} name={id}>
          <Section />
        </ErrorBoundary>
      ))}
      <MediaHeader />
      {empty ? (
        <MediaEmpty />
      ) : rows.length > 0 ? (
        <LibraryRows rows={rows} compact />
      ) : (
        <p className="py-6 text-center text-muted-foreground">Nothing in here.</p>
      )}
      <DropHint />
      {dropActive && <DropOverlay />}
    </section>
  );
}
