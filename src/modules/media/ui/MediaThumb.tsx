import { formatTimecode } from "@/core";
import type { MediaAsset } from "@/modules/project";
import { ProgressBar, SealMark, Waveform } from "@/ui";
import type { MediaProbe } from "../media.types";

/** Short status shown on the thumbnail while its file is being prepared. */
function statusOf(probe: MediaProbe | undefined): string | null {
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
  return probe?.status === "ready" ? null : "Loading…";
}

interface MediaThumbProps {
  asset: MediaAsset;
  probe: MediaProbe | undefined;
}

/** The picture of a library item: poster or waveform, badges, and preparation progress. */
export function MediaThumb({ asset, probe }: MediaThumbProps) {
  const status = statusOf(probe);
  const proxy = probe?.proxy;
  const encoding = proxy?.state === "encoding" || proxy?.state === "queued";

  return (
    <div className="relative aspect-[16/10] overflow-hidden border border-border bg-surface-sunken outline-2 -outline-offset-1 outline-transparent transition-[outline-color] duration-150 group-hover:outline-ring">
      {probe?.posterUrl ? (
        <img src={probe.posterUrl} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        asset.kind === "audio" && (
          <Waveform className="absolute inset-x-[8%] inset-y-[22%] text-ice-400" />
        )
      )}

      {proxy?.state === "ready" && (
        <span
          className="absolute left-1 top-1 bg-black/60 px-1 text-2xs font-semibold tracking-[0.04em] text-ice-300"
          title={proxy.message}
        >
          PROXY
        </span>
      )}
      {probe?.duration !== undefined && (
        <span className="absolute bottom-1 right-1 bg-black/60 px-1 font-mono text-2xs text-white">
          {formatTimecode(probe.duration)}
        </span>
      )}

      {status && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 px-1 text-center text-2xs font-medium text-white">
          {probe?.status !== "error" && <SealMark className="size-[22px] animate-bob-fast" />}
          {status}
          {encoding && <ProgressBar value={proxy?.progress ?? 0} className="mt-0.5 w-3/5" />}
        </div>
      )}
    </div>
  );
}
