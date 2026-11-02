import { formatTimecode } from "@/core";
import type { MediaAsset } from "@/modules/project";
import { ProgressBar, SealMark, Waveform, cn } from "@/ui";
import type { MediaProbe } from "../media.types";

/** Short status shown on the thumbnail while its file is being prepared. */
function statusOf(probe: MediaProbe | undefined): string | null {
  if (probe?.status === "error") return "Can't play";
  if (probe?.status === "missing") return "Missing";
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
  /** Marks it in red pencil: it's on a timeline. */
  used?: boolean;
  /** Small, in a list: leaves out the badges. */
  compact?: boolean;
}

/** The picture of a library item: poster or waveform, badges, and preparation progress. */
export function MediaThumb({ asset, probe, used, compact }: MediaThumbProps) {
  const status = statusOf(probe);
  const proxy = probe?.proxy;
  const encoding = proxy?.state === "encoding" || proxy?.state === "queued";
  const animated = proxy?.meta?.frames !== undefined;
  const still = asset.kind === "image" && !animated;

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden bg-surface-sunken",
        used
          ? "shadow-[0_0_0_2px_var(--mark)]"
          : "shadow-[0_0_0_1px_var(--border-strong)] group-hover:shadow-[0_0_0_1.5px_var(--ring)]",
      )}
    >
      {probe?.posterUrl ? (
        <img src={probe.posterUrl} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        asset.kind === "audio" && (
          <Waveform className="absolute inset-x-[8%] inset-y-[22%] text-muted-foreground" />
        )
      )}

      {compact ? null : animated ? (
        <span className="absolute left-1 top-1 bg-black/60 px-1 text-2xs font-semibold tracking-[0.04em] text-ice-300">
          GIF
        </span>
      ) : (
        proxy?.state === "ready" &&
        asset.kind !== "image" && (
          <span
            className="absolute left-1 top-1 bg-black/60 px-1 text-2xs font-semibold tracking-[0.04em] text-ice-300"
            title={proxy.message}
          >
            PROXY
          </span>
        )
      )}
      {!compact && probe?.duration !== undefined && !still && (
        <span className="absolute bottom-0 right-0 bg-surface px-[3px] font-mono text-[10.5px] font-bold text-foreground">
          {formatTimecode(probe.duration)}
        </span>
      )}

      {status && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 px-1 text-center text-2xs font-medium text-white">
          {probe?.status !== "error" && probe?.status !== "missing" && (
            <SealMark className="h-[22px] w-[26px] animate-bob-fast" />
          )}
          {status}
          {encoding && <ProgressBar value={proxy?.progress ?? 0} className="mt-0.5 w-3/5" />}
        </div>
      )}
    </div>
  );
}
