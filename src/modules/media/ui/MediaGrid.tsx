import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, type MediaId } from "@/modules/project";
import { MediaTile } from "./MediaTile";

/** The library's items as thumbnails, in import order. */
export function MediaGrid({ ids }: { ids: readonly MediaId[] }) {
  const media = useStore(useModule(projectRef).store.api, (s) => s.media);
  return (
    <div className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-2.5">
      {ids.map((id) => {
        const asset = media[id];
        return asset ? <MediaTile key={id} asset={asset} /> : null;
      })}
    </div>
  );
}
