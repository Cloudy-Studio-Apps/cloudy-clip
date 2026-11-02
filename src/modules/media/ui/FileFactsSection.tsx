import { FolderOpen } from "lucide-react";
import { useStore } from "zustand";
import { formatTimecode, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { Button } from "@/ui";
import { mediaRef } from "../media.ref";
import type { FileFacts, MediaProbe } from "../media.types";
import { useFileFacts } from "./file.facts.hook";

const PROXY_LABEL: Record<string, string> = {
  analyzing: "Checking",
  queued: "Waiting",
  encoding: "Making",
  ready: "Ready",
  skipped: "Not needed",
  error: "Failed",
};

function Fact({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="min-w-0">
      <span className="block text-[11.5px] text-subtle-foreground">{label}</span>
      <b className="block truncate text-[12.5px]">{value ?? "—"}</b>
    </div>
  );
}

function audioFormat({ channels }: FileFacts): string | undefined {
  if (channels === undefined) return undefined;
  if (channels === 1) return "Mono";
  return channels === 2 ? "Stereo" : `${channels} channels`;
}

function sizeOf(probe: MediaProbe | undefined): string | undefined {
  return probe?.width && probe.height ? `${probe.width} × ${probe.height}` : undefined;
}

/** What a file is: name, length, codecs, proxy, and where it lives. */
export function FileFactsSection({ mediaId }: { mediaId: string }) {
  const media = useModule(mediaRef);
  const asset = useStore(useModule(projectRef).store.api, (s) => s.media[mediaId]);
  const probe = useStore(media.probes, (s) => s.probes[mediaId]);
  const facts = useFileFacts(mediaId);
  if (!asset) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px]" title={asset.path}>
          {asset.name}
        </span>
        {probe?.duration !== undefined && (
          <span className="shrink-0 font-mono text-[12.5px] font-bold text-muted-foreground">
            {formatTimecode(probe.duration)}
          </span>
        )}
      </div>
      {probe?.status === "missing" && (
        <p className="text-sm text-destructive">This file isn't where the project says.</p>
      )}
      <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-x-2 gap-y-2.5">
        <Fact label="Video codec" value={facts.videoCodec?.toUpperCase()} />
        <Fact label="Frame rate" value={media.pictureMeta(mediaId)?.fps} />
        <Fact label="Resolution" value={sizeOf(probe)} />
        <Fact label="Audio codec" value={facts.audioCodec?.toUpperCase()} />
        <Fact label="Sample rate" value={facts.sampleRate} />
        <Fact label="Audio format" value={audioFormat(facts)} />
      </div>
      <div className="flex min-h-[26px] items-center justify-between text-muted-foreground">
        Proxy
        <b className="text-foreground">{PROXY_LABEL[probe?.proxy?.state ?? ""] ?? "—"}</b>
      </div>
      <Button
        className="w-full"
        title={`Show ${asset.name} in your file manager`}
        disabled={probe?.status === "missing"}
        onClick={() => void media.revealFile(asset.path)}
      >
        <FolderOpen />
        Open file location
      </Button>
    </div>
  );
}
