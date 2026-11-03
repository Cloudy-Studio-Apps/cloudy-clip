import { useSyncExternalStore } from "react";
import { useKernel, useModule } from "@/core";
import { previewRef, setLoop } from "@/modules/preview";
import { frameDuration, projectRef, useOpenComposition } from "@/modules/project";
import { timelineRef } from "@/modules/timeline";
import { loopAround } from "../../logic/loop";
import { TransportTool } from "./TransportTool";

/**
 * Loop in the transport row: on, it loops the selected clips (the whole composition when none is
 * selected); off, it clears the loop. The ends are moved on the ruler.
 */
export function LoopToggle() {
  const { bus } = useKernel();
  const { playback } = useModule(previewRef);
  const project = useModule(projectRef).store;
  const timeline = useModule(timelineRef);
  const composition = useOpenComposition();
  const loop = useSyncExternalStore(playback.onLoopChange, playback.getLoop);

  return (
    <TransportTool
      pressed={loop !== null}
      // Nothing a frame long to loop yet.
      disabled={!loop && (!composition || composition.duration < frameDuration(composition.format))}
      title={
        loop
          ? "Looping: drag its ends on the ruler. Click to stop looping"
          : "Loop the selected clips, or the whole timeline when none is selected"
      }
      onClick={() => {
        if (loop) return void bus.run(setLoop, { range: null });
        if (!composition) return;
        const { selection } = timeline.view.getState();
        const range = loopAround(project.getState(), selection, composition.duration);
        void bus.run(setLoop, { range });
      }}
    >
      Loop
    </TransportTool>
  );
}
