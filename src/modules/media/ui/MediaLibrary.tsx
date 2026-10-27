import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { mediaRef } from "../media.ref";
import { DropHint, DropOverlay } from "./MediaDrop";
import { MediaEmpty } from "./MediaEmpty";
import { MediaGrid } from "./MediaGrid";
import { MediaHeader } from "./MediaHeader";

/** The media library panel: import files and drag them onto the timeline. */
export function MediaLibrary() {
  const project = useModule(projectRef).store;
  const mediaOrder = useStore(project.api, (s) => s.mediaOrder);
  const dropActive = useStore(useModule(mediaRef).fileDrop, (s) => s.active);

  return (
    <section className="relative flex h-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-2.5">
      <MediaHeader count={mediaOrder.length} />
      {mediaOrder.length === 0 ? <MediaEmpty /> : <MediaGrid ids={mediaOrder} />}
      <DropHint />
      {dropActive && <DropOverlay />}
    </section>
  );
}
