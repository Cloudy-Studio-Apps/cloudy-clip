import { useStore } from "zustand";
import { useModule } from "@/core";
import { timelineRef } from "@/modules/timeline";
import { soon } from "../soon";
import { TransportTool } from "./TransportTool";

/**
 * The pointer tools: Select (the only one that works yet, so always current), the blade Cut, Fade,
 * Draw volume and Scrub (coming soon), and Snap, the Sound timeline's own snapping switch.
 */
export function PointerTools() {
  const timeline = useModule(timelineRef);
  const snaps = useStore(timeline.view, (s) => !s.unsnapped.includes("sound"));

  return (
    <>
      <TransportTool current title="Select: move, trim and fade clips">
        Select
      </TransportTool>
      <TransportTool {...soon("transport.cut")}>Cut</TransportTool>
      <TransportTool {...soon("transport.fade")}>Fade</TransportTool>
      <TransportTool {...soon("transport.drawVolume")}>Draw volume</TransportTool>
      <TransportTool {...soon("transport.scrub")}>Scrub</TransportTool>
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
