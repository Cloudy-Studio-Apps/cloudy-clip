import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { PreviewStage } from "@/modules/preview";
import { TimelinePanel, type TrackFocus } from "@/modules/timeline";
import { cn } from "@/ui";
import { soundRef } from "../sound.ref";
import { MeterLoopProvider, MixerPanel, useMeterLoop } from "./mixer";
import { SoundPanel } from "./panel";
import { SoundTransport } from "./transport";

/**
 * The Sound page: the transport row; on the left the audio-only timeline over the panel and a small
 * preview; on the right the mixer. It runs the page's one meter loop for both the mixer's meters
 * and the Channel tab's compressor reduction. Mounted only while the page is open, so its preview takes the
 * frames only then and the editor's gets them back when it closes.
 */
export function SoundPage() {
  const sound = useModule(soundRef);
  // The master has no header on the timeline.
  const selected = useStore(sound.view, (s) => (s.selected === "master" ? null : s.selected));
  const expanded = useStore(sound.view, (s) => s.expanded);
  const loop = useMeterLoop();
  const focus = useMemo<TrackFocus>(
    () => ({ selected, select: (trackId) => sound.select(trackId) }),
    [selected, sound],
  );

  return (
    <MeterLoopProvider value={loop}>
      <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[44px_minmax(0,1fr)] bg-surface">
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
    </MeterLoopProvider>
  );
}
