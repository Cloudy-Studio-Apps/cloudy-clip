import { memo } from "react";
import { useStore } from "zustand";
import { formatTimecode, useKernel } from "@/core";
import type { MediaAsset } from "@/modules/project";
import { removeMedia } from "../media.commands";
import { startMediaDrag } from "../media.drag";
import { mediaProbeStore } from "../media.store";
import type { MediaProbe } from "../media.types";

/** Short status shown on the thumbnail while there is no poster. */
function placeholder(asset: MediaAsset, probe: MediaProbe | undefined): string {
  if (probe?.status === "error") return "Can't play";
  switch (probe?.proxy?.state) {
    case undefined:
    case "analyzing":
      return "Analyzing…";
    case "queued":
      return "Waiting to optimize…";
    case "encoding":
      return `Optimizing ${Math.round((probe.proxy.progress ?? 0) * 100)}%`;
  }
  return asset.kind === "audio" ? "♪ Audio" : "Loading…";
}

/** One item of the library. Drag it onto the timeline to add a clip. */
export const MediaTile = memo(function MediaTile({ asset }: { asset: MediaAsset }) {
  const { bus } = useKernel();
  const probe = useStore(mediaProbeStore, (s) => s.probes[asset.id]);
  const ready = probe?.status === "ready";
  const proxy = probe?.proxy;
  const encoding = proxy?.state === "encoding" || proxy?.state === "queued";
  const tooltip = [asset.path, probe?.error ?? proxy?.message].filter(Boolean).join("\n");

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-900 ${
        ready ? "cursor-grab" : "cursor-default"
      }`}
      title={tooltip}
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
          <span className="px-2 text-center text-xs text-neutral-500">
            {placeholder(asset, probe)}
          </span>
        )}
        {proxy?.state === "ready" && (
          <span
            className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[9px] font-medium uppercase tracking-wide text-sky-300"
            title={proxy.message}
          >
            Proxy
          </span>
        )}
        {probe?.duration !== undefined && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] tabular-nums text-neutral-200">
            {formatTimecode(probe.duration)}
          </span>
        )}
        {encoding && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-800">
            <div
              className="h-full bg-sky-500 transition-[width] duration-300"
              style={{ width: `${Math.round((proxy?.progress ?? 0) * 100)}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col px-2 py-1">
        <span
          className={`truncate text-xs ${probe?.status === "error" ? "text-red-400" : "text-neutral-300"}`}
        >
          {asset.name}
        </span>
        {probe?.status === "error" && probe.error && (
          <span className="line-clamp-2 text-[10px] leading-tight text-red-400/80">
            {probe.error}
          </span>
        )}
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
