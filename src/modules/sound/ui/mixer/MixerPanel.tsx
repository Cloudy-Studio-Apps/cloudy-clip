import { Maximize, Minimize } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition, type Track, type TrackId } from "@/modules/project";
import { Button, cn, EmptyState } from "@/ui";
import { soundRef } from "../../sound.ref";
import { MasterStrip } from "./MasterStrip";
import { MeterLoopProvider } from "./meters.context";
import { useMeterLoop } from "./meters.hook";
import { MixerStrip } from "./MixerStrip";

const NO_TRACKS: readonly TrackId[] = [];

/**
 * The mixer: a strip per audio track of the open composition in `trackOrder`, scrolling sideways,
 * and Master pinned at the right edge. Expand all lets it take the page.
 */
export function MixerPanel() {
  const sound = useModule(soundRef);
  const open = useOpenComposition();
  const trackOrder = open?.trackOrder ?? NO_TRACKS;
  const tracksById = useStore(useModule(projectRef).store.api, (s) => s.tracks);
  const selected = useStore(sound.view, (s) => s.selected);
  const solo = useStore(sound.view, (s) => s.solo);
  const expanded = useStore(sound.view, (s) => s.expanded);
  const loop = useMeterLoop();
  const tracks = useMemo(
    () =>
      trackOrder.flatMap((id): Track[] => {
        const track = tracksById[id];
        return track?.kind === "audio" ? [track] : [];
      }),
    [trackOrder, tracksById],
  );

  return (
    <MeterLoopProvider value={loop}>
      <section
        className={cn(
          "flex min-w-0 flex-col border-l border-border-strong bg-surface",
          expanded ? "flex-1 border-l-0" : "w-[46vw] max-w-[860px] shrink-0",
        )}
      >
        <header className="flex h-[34px] shrink-0 items-center gap-3.5 border-b border-border-strong bg-muted pl-3 pr-2">
          <h3 className="font-hand text-md font-bold">Mixer</h3>
          <span className="flex-1" />
          <span className="whitespace-nowrap font-mono text-sm text-muted-foreground">
            {tracks.length + 1} strips
          </span>
          <Button
            size="sm"
            variant={expanded ? "primary" : "secondary"}
            onClick={() => sound.setExpanded(!expanded)}
          >
            {expanded ? <Minimize /> : <Maximize />}
            {expanded ? "Back to timeline" : "Expand all"}
          </Button>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            {tracks.length === 0 ? (
              <EmptyState title="No audio tracks" className="m-3">
                Add one with Audio track on the timeline, or place a video with sound on the Edit
                page.
              </EmptyState>
            ) : (
              tracks.map((track, index) => (
                <MixerStrip
                  key={track.id}
                  track={track}
                  code={`A${index + 1}`}
                  selected={track.id === selected}
                  soloed={solo.includes(track.id)}
                />
              ))
            )}
          </div>
          <MasterStrip compositionId={open?.id} />
        </div>
      </section>
    </MeterLoopProvider>
  );
}
