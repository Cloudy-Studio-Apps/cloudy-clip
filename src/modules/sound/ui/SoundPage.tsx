import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { PreviewStage } from "@/modules/preview";
import { TimelinePanel, type TrackFocus } from "@/modules/timeline";
import { cn } from "@/ui";
import { soundRef } from "../sound.ref";
import { MixerPanel } from "./MixerPanel";
import { SoundPanel } from "./SoundPanel";
import { SoundTransport } from "./SoundTransport";

/**
 * The Sound page: the transport row; on the left the audio-only timeline over the panel and a small
 * preview; on the right the mixer. Mounted only while the page is open, so its preview takes the
 * frames only then and the editor's gets them back when it closes.
 */
export function SoundPage() {
  const sound = useModule(soundRef);
  const selected = useStore(sound.view, (s) => s.selectedTrack);
  const expanded = useStore(sound.view, (s) => s.expanded);
  const focus = useMemo<TrackFocus>(
    () => ({ selected, select: (trackId) => sound.selectTrack(trackId) }),
    [selected, sound],
  );

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)] bg-surface">
      <SoundTransport />
      <div className="flex min-h-0">
        {/* Hidden, not unmounted, by Expand all: the timeline keeps its place. */}
        <div className={cn("flex min-w-0 flex-1 flex-col", expanded && "hidden")}>
          <div className="min-h-0 flex-1">
            <TimelinePanel scope="sound" focus={focus} />
          </div>
          <div className="flex h-[292px] shrink-0 border-t border-border-strong">
            <SoundPanel />
            <div className="flex w-[300px] shrink-0 border-l border-border-strong">
              <PreviewStage bare />
            </div>
          </div>
        </div>
        <MixerPanel />
      </div>
    </div>
  );
}
