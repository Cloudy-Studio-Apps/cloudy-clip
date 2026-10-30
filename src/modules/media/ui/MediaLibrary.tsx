import { useStore } from "zustand";
import { ErrorBoundary, useModule, usePoint } from "@/core";
import { projectRef } from "@/modules/project";
import { librarySections } from "../media.points";
import { mediaRef } from "../media.ref";
import { DropHint, DropOverlay } from "./MediaDrop";
import { MediaEmpty } from "./MediaEmpty";
import { MediaGrid } from "./MediaGrid";
import { MediaHeader } from "./MediaHeader";

/** The Library panel: compositions and imported files, dragged from here onto the timeline. */
export function MediaLibrary() {
  const project = useModule(projectRef).store;
  const mediaOrder = useStore(project.api, (s) => s.mediaOrder);
  const dropActive = useStore(useModule(mediaRef).fileDrop, (s) => s.active);
  const sections = usePoint(librarySections);

  return (
    <section className="relative flex h-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-2.5">
      {sections.map(({ id, component: Section }) => (
        <ErrorBoundary key={id} name={id}>
          <Section />
        </ErrorBoundary>
      ))}
      <MediaHeader count={mediaOrder.length} />
      {mediaOrder.length === 0 ? <MediaEmpty /> : <MediaGrid ids={mediaOrder} />}
      <DropHint />
      {dropActive && <DropOverlay />}
    </section>
  );
}
