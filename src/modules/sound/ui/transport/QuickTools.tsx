import { soon } from "../soon";
import { TransportTool } from "./TransportTool";

/** One-click jobs on the selected clips: Find beats, Strip silence, Match level (coming soon). */
export function QuickTools() {
  return (
    <>
      <TransportTool {...soon("transport.findBeats")}>Find beats</TransportTool>
      <TransportTool {...soon("transport.stripSilence")}>Strip silence</TransportTool>
      <TransportTool {...soon("transport.matchLevel")}>Match level</TransportTool>
    </>
  );
}
