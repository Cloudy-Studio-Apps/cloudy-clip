import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { soundRef } from "../../sound.ref";
import { soon } from "../soon";
import { TransportTool } from "./TransportTool";

/**
 * The pointer tools: Select and Draw volume (the current one underlined; the timeline's pen is the
 * same tool), the blade Cut, Fade and Scrub (coming soon; they give way on a narrow window), and
 * Snap, the Sound timeline's own snapping switch.
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
      {/* Coming soon: on a narrow window these clip (after the quick tools), never what works. */}
      <span className="flex min-w-0 shrink items-center overflow-hidden">
        <TransportTool {...soon("transport.cut")}>Cut</TransportTool>
        <TransportTool {...soon("transport.fade")}>Fade</TransportTool>
      </span>
      <TransportTool
        current={tool === "draw"}
        title="Draw volume: drag over a clip to draw its volume, or over a track whose line is in front (L)"
        onClick={() => sound.setTool("draw")}
      >
        Draw volume
      </TransportTool>
      <span className="flex min-w-0 shrink items-center overflow-hidden">
        <TransportTool {...soon("transport.scrub")}>Scrub</TransportTool>
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
