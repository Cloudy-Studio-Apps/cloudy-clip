import { formatTimecode, useModule } from "@/core";
import { useStore } from "zustand";
import { projectRef } from "@/modules/project";
import { cn } from "@/ui";
import { startMediaDrag } from "../media.drag";
import { mediaRef } from "../media.ref";
import { MediaThumb } from "./MediaThumb";

/** A file as one line of the list view. */
export function LibraryListRow({ id, used }: { id: string; used: boolean }) {
  const media = useModule(mediaRef);
  const asset = useStore(useModule(projectRef).store.api, (s) => s.media[id]);
  const probe = useStore(media.probes, (s) => s.probes[id]);
  if (!asset) return null;
  const ready = probe?.status === "ready" || media.pictureMeta(id) !== undefined;
  return (
    <div
      className={cn("flex items-center gap-3 py-1", ready && "cursor-grab")}
      onPointerDown={(event) => {
        if (event.button === 0 && ready) {
          startMediaDrag({ type: "media", id }, asset.name, event.nativeEvent);
        }
      }}
    >
      <div className="w-[72px] shrink-0">
        <MediaThumb asset={asset} probe={probe} compact />
      </div>
      <span className={cn("min-w-0 flex-1 truncate", used && "font-bold text-mark")}>
        {asset.name}
      </span>
      <span className="shrink-0 font-mono text-[11.5px] text-subtle-foreground">
        {probe?.duration === undefined ? asset.kind : formatTimecode(probe.duration)}
      </span>
    </div>
  );
}
