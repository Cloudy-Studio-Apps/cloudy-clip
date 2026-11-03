import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { PlayButton, previewRef, Timecode } from "@/modules/preview";
import { playheadSplit, splitAt, timelineRef } from "@/modules/timeline";
import { LoopToggle } from "./LoopToggle";
import { MixSwitch } from "./MixSwitch";
import { MonitorControls } from "./MonitorControls";
import { RecordButton } from "./RecordButton";
import { TransportSeparator } from "./TransportSeparator";
import { TransportTool } from "./TransportTool";

/**
 * The Sound page's transport row: the time and play, Loop, Record, Cut at the playhead and Snap,
 * Mix A and B, and how the user listens. Select joins when there is a second pointer tool to choose from.
 */
export function SoundTransport() {
  const { bus } = useKernel();
  const { playback } = useModule(previewRef);
  const timeline = useModule(timelineRef);
  const snaps = useStore(timeline.view, (s) => !s.unsnapped.includes("sound"));

  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-hidden border-b border-border-strong bg-surface px-3">
      <span className="mr-3 shrink-0">
        <Timecode />
      </span>
      <PlayButton />
      <LoopToggle />
      <RecordButton />
      <TransportSeparator />
      <TransportTool
        title="Cut at the playhead (S)"
        onClick={() =>
          void bus.run(
            splitAt,
            playheadSplit(playback.getTime(), timeline.view.getState().selection),
          )
        }
      >
        Cut
      </TransportTool>
      <TransportTool
        pressed={snaps}
        title={snaps ? "Snapping on: drags snap to edges, cuts and the playhead" : "Snapping off"}
        onClick={() => timeline.setSnap("sound", !snaps)}
      >
        Snap
      </TransportTool>
      <span className="min-w-0 flex-1" />
      <MixSwitch />
      <TransportSeparator />
      <MonitorControls />
    </div>
  );
}
