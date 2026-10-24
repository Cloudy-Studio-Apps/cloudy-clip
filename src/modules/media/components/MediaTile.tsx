import { memo } from "react";
import { useStore } from "zustand";
import { formatTimecode, useKernel } from "@/core";
import type { MediaAsset } from "@/modules/project";
import { removeMedia } from "../media.commands";
import { startMediaDrag } from "../media.drag";
import { mediaProbeStore } from "../media.store";

/** One item of the library. Drag it onto the timeline to add a clip. */
export const MediaTile = memo(function MediaTile({ asset }: { asset: MediaAsset }) {
  const { bus } = useKernel();
  const probe = useStore(mediaProbeStore, (s) => s.probes[asset.id]);
  const ready = probe?.status === "ready";

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900 ${
        ready ? "cursor-grab" : "cursor-default"
      }`}
      title={probe?.error ?? asset.path}
      onPointerDown={(e) => {
        if (e.button !== 0 || !ready) return;
        startMediaDrag(asset.id, asset.name, e.nativeEvent);
      }}
    >
      <div className="relative flex aspect-video items-center justify-center bg-neutral-950">
        {probe?.posterUrl ? (
          <img
            src={probe.posterUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-xs text-neutral-500">
            {probe?.status === "error"
              ? "Unsupported"
              : asset.kind === "audio"
                ? "♪ Audio"
                : "Loading…"}
          </span>
        )}
        {probe?.duration !== undefined && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] tabular-nums text-neutral-200">
            {formatTimecode(probe.duration)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-1">
        <span
          className={`truncate text-xs ${probe?.status === "error" ? "text-red-400" : "text-neutral-300"}`}
        >
          {asset.name}
        </span>
      </div>
      <button
        type="button"
        aria-label={`Remove ${asset.name}`}
        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-black/70 text-xs text-neutral-300 hover:text-white group-hover:flex"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => void bus.run(removeMedia, { mediaId: asset.id })}
      >
        ×
      </button>
    </div>
  );
});
