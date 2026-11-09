import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { soundRef } from "../../sound.ref";
import { TransportTool } from "./TransportTool";

/**
 * The pointer tools: Select, Cut, Fade, Draw volume (the timeline's pen is the same tool) and
 * Scrub, the current one underlined (`view.tool`, a view write); Cut, Fade and Scrub give way
 * first on a narrow window. Then Snap, the Sound timeline's own snapping switch.
 */
export function PointerTools() {
  const timeline = useModule(timelineRef);
  const sound = useModule(soundRef);
  const snaps = useStore(timeline.view, (s) => !s.unsnapped.includes("sound"));
  const tool = useStore(sound.view, (s) => s.tool);

  return (
    <>
      <TransportTool
        current={tool === "select"}
        title="Select: move, trim and fade clips"
        onClick={() => sound.setTool("select")}
      >
        Select
      </TransportTool>
      <span className="flex min-w-0 shrink items-center overflow-hidden">
        <TransportTool
          current={tool === "cut"}
          title="Cut: click a clip to cut it there, Shift for every track. To cut at the playhead: Split, or S"
          onClick={() => sound.setTool("cut")}
        >
          Cut
        </TransportTool>
        <TransportTool
          current={tool === "fade"}
          title="Fade: drag from a clip's edge to set its fade"
          onClick={() => sound.setTool("fade")}
        >
          Fade
        </TransportTool>
      </span>
      <TransportTool
        current={tool === "draw"}
        title="Draw volume: drag over a clip to draw its volume, or over a track whose line is in front (L)"
        onClick={() => sound.setTool("draw")}
      >
        Draw volume
      </TransportTool>
      <span className="flex min-w-0 shrink items-center overflow-hidden">
        <TransportTool
          current={tool === "scrub"}
          title="Scrub: drag over the lanes to hear the sound under the pointer"
          onClick={() => sound.setTool("scrub")}
        >
          Scrub
        </TransportTool>
      </span>
      <TransportTool
        pressed={snaps}
        title={snaps ? "Snapping on: drags snap to edges, cuts and the playhead" : "Snapping off"}
        onClick={() => timeline.setSnap("sound", !snaps)}
      >
        Snap
      </TransportTool>
    </>
  );
}
