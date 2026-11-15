import { useStore } from "zustand";
import { notify, useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { cancelBeats, findBeats } from "../../sound.beats.commands";
import { soundRef } from "../../sound.ref";
import { report } from "../report";
import { soon } from "../soon";
import { TransportTool } from "./TransportTool";

/**
 * One-click jobs on the selected clips: Find beats (the selected clips' files, or every audio clip
 * of the open composition when none is selected; while it runs it shows its progress and a click
 * cancels it), Strip silence (opens its dialog on the selected sound; gaps stay, pictures are never touched) and Match level (coming soon).
 */
export function QuickTools() {
  const { bus } = useKernel();
  const running = useStore(useModule(soundRef).beats.state, (s) => s.running);
  const view = useModule(timelineRef).view;
  const project = useModule(projectRef).store;
  const { openSilence } = useModule(soundRef);
  const find = () => {
    const selection = view.getState().selection;
    void bus.run(findBeats, selection.length > 0 ? { clipIds: selection } : {}).then(report);
  };
  const strip = () => {
    const state = project.getState();
    const clipIds = view
      .getState()
      .selection.filter((id) => state.tracks[state.clips[id]?.trackId ?? ""]?.kind === "audio");
    if (clipIds.length === 0) notify("info", "Select a clip with sound to strip its silence");
    else openSilence({ clipIds, soundOnly: true });
  };
  return (
    <>
      {running ? (
        <TransportTool
          pressed
          title="Stop finding beats"
          onClick={() => void bus.run(cancelBeats, {}).then(report)}
        >
          Beats {Math.round(running.progress * 100)}%
        </TransportTool>
      ) : (
        <TransportTool
          title="Find beats: ticks in the ruler that drags snap to (the selected clips, or every audio clip)"
          onClick={find}
        >
          Find beats
        </TransportTool>
      )}
      <TransportTool
        title="Strip silence: cut the silent stretches out of the selected sound, leaving gaps (pictures stay)"
        onClick={strip}
      >
        Strip silence
      </TransportTool>
      <TransportTool {...soon("transport.matchLevel")}>Match level</TransportTool>
    </>
  );
}
