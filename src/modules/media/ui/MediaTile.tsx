import { X } from "lucide-react";
import { memo } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import type { MediaAsset } from "@/modules/project";
import { cn } from "@/ui";
import { removeMedia } from "../media.commands";
import { startMediaDrag } from "../media.drag";
import { mediaRef } from "../media.ref";
import { MediaThumb } from "./MediaThumb";

/** One item of the library. Drag it onto the timeline to add a clip. */
export const MediaTile = memo(function MediaTile({ asset }: { asset: MediaAsset }) {
  const { bus } = useKernel();
  const probe = useStore(useModule(mediaRef).probes, (s) => s.probes[asset.id]);
  const ready = probe?.status === "ready";
  const failed = probe?.status === "error";
  const tooltip = [asset.path, probe?.error ?? probe?.proxy?.message].filter(Boolean).join("\n");

  return (
    <div
      className={cn("group relative", ready ? "cursor-grab" : "cursor-progress")}
      title={tooltip}
      onPointerDown={(e) => {
        if (e.button !== 0 || !ready) return;
        startMediaDrag(asset.id, asset.name, e.nativeEvent);
      }}
    >
      <MediaThumb asset={asset} probe={probe} />
      <p
        className={cn(
          "mt-1 truncate text-xs",
          failed ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {asset.name}
      </p>
      {failed && probe.error && (
        <p className="line-clamp-2 text-2xs text-destructive/80">{probe.error}</p>
      )}
      <button
        type="button"
        aria-label={`Remove ${asset.name}`}
        title="Remove from project"
        className="absolute right-1 top-1 hidden size-5 cursor-pointer place-items-center bg-black/60 text-white hover:bg-black/80 group-hover:grid"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void bus.run(removeMedia, { mediaId: asset.id })}
      >
        <X className="size-3" />
      </button>
    </div>
  );
});
