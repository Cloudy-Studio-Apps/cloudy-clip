import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { useStore } from "zustand";
import { formatTimecode, secondsToMicros, useModule } from "@/core";
import { projectRef, type MediaAsset } from "@/modules/project";
import { Button, IconButton } from "@/ui";
import { mediaRef } from "../media.ref";
import { useLocateMedia } from "./media.locate.hook";

/** Plays one file in its own element. Time moves by direct DOM writes, never through React. */
function Player({ asset }: { asset: MediaAsset }) {
  const media = useModule(mediaRef);
  const player = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const url = media.mediaUrl(asset.id);

  const show = () => {
    const element = player.current;
    if (!element) return;
    const share = element.duration > 0 ? element.currentTime / element.duration : 0;
    if (scrub.current) {
      scrub.current.value = String(share);
      scrub.current.style.setProperty("--v", `${share * 100}%`);
    }
    if (time.current) {
      time.current.textContent = formatTimecode(secondsToMicros(element.currentTime));
    }
  };
  const events = {
    ref: player,
    src: url,
    crossOrigin: "anonymous" as const,
    onTimeUpdate: show,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
  };

  return (
    <>
      {asset.kind === "audio" ? (
        <audio {...events} />
      ) : (
        <video
          {...events}
          playsInline
          className="aspect-video w-full bg-black shadow-[0_0_0_1px_var(--border-strong)]"
        />
      )}
      <input
        ref={scrub}
        type="range"
        aria-label="Position"
        min={0}
        max={1}
        step={0.001}
        defaultValue={0}
        className="mt-2 w-full"
        onChange={(event) => {
          const element = player.current;
          if (!element || !(element.duration > 0)) return;
          element.currentTime = Number(event.target.value) * element.duration;
          show();
        }}
      />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <span ref={time} className="font-mono text-md font-bold">
          {formatTimecode(0)}
        </span>
        <IconButton
          label={playing ? "Pause" : "Play"}
          variant="solid"
          className="size-[30px]"
          onClick={() => {
            const element = player.current;
            if (!element) return;
            if (element.paused) void element.play();
            else element.pause();
          }}
        >
          {playing ? <Pause /> : <Play />}
        </IconButton>
        <span className="justify-self-end font-mono text-[12.5px] text-subtle-foreground">
          {formatTimecode(media.getProbe(asset.id)?.duration ?? 0)}
        </span>
      </div>
    </>
  );
}

/** Says why a file can't be shown, and offers to find it. */
function Unplayable({ asset }: { asset: MediaAsset }) {
  const media = useModule(mediaRef);
  const probe = useStore(media.probes, (s) => s.probes[asset.id]);
  const locate = useLocateMedia();
  const missing = probe?.status === "missing";
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-stage px-4 text-center text-muted-foreground shadow-[0_0_0_1px_var(--border-strong)]">
      {missing ? `${asset.name} isn't where the project says.` : probe?.error}
      {missing && (
        <Button size="sm" onClick={() => void locate(asset)}>
          Locate…
        </Button>
      )}
    </div>
  );
}

/** Shows the selected item above its details. Its element goes when you leave the page. */
export function MediaViewer() {
  const media = useModule(mediaRef);
  const selected = useStore(media.view, (s) => s.selection[0]);
  const project = useModule(projectRef).store.api;
  const asset = useStore(project, (s) => (selected ? s.media[selected] : undefined));
  const composition = useStore(project, (s) => (selected ? s.compositions[selected] : undefined));
  const solid = useStore(project, (s) => (selected ? s.solids[selected] : undefined));
  const status = useStore(media.probes, (s) => (selected ? s.probes[selected]?.status : undefined));

  let body = (
    <div className="flex aspect-video items-center justify-center bg-stage text-subtle-foreground shadow-[0_0_0_1px_var(--border-strong)]">
      Nothing selected
    </div>
  );
  if (composition) {
    body = (
      <div className="flex aspect-video flex-col items-center justify-center bg-stage shadow-[0_0_0_1px_var(--border-strong)]">
        <span className="font-hand font-bold">{composition.name}</span>
        <span className="font-mono text-subtle-foreground">
          {formatTimecode(composition.duration)}
        </span>
      </div>
    );
  } else if (solid) {
    body = (
      <div
        className="aspect-video shadow-[0_0_0_1px_var(--border-strong)]"
        style={{ backgroundColor: solid.color }}
      />
    );
  } else if (asset && (status === "missing" || status === "error")) {
    body = <Unplayable asset={asset} />;
  } else if (asset?.kind === "image") {
    body = (
      <img
        src={media.mediaUrl(asset.id)}
        alt={asset.name}
        crossOrigin="anonymous"
        className="aspect-video w-full bg-black object-contain shadow-[0_0_0_1px_var(--border-strong)]"
      />
    );
  } else if (asset) {
    body = <Player key={asset.id} asset={asset} />;
  }
  return <div className="shrink-0 border-b border-border-strong p-3 pb-1.5">{body}</div>;
}
