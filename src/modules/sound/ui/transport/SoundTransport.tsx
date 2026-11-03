import { Timecode } from "@/modules/preview";
import { LoopToggle } from "./LoopToggle";
import { MixSwitch } from "./MixSwitch";
import { MonitorControls } from "./MonitorControls";
import { PlaybackButtons } from "./PlaybackButtons";
import { PointerTools } from "./PointerTools";
import { QuickTools } from "./QuickTools";
import { RecordButton } from "./RecordButton";
import { TransportSeparator } from "./TransportSeparator";

/**
 * The Sound page's transport row, in the prototype's order: the time, Back, Play and Stop, Record
 * and Loop; the pointer tools and Snap; the quick tools; then Mix A and B and how the user
 * listens. A narrow window clips it at the right.
 */
export function SoundTransport() {
  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-hidden border-b border-border-strong bg-surface px-3">
      <span className="mr-3 shrink-0">
        <Timecode compact />
      </span>
      <PlaybackButtons />
      <RecordButton />
      <LoopToggle />
      <TransportSeparator />
      <PointerTools />
      <TransportSeparator />
      <QuickTools />
      <span className="min-w-0 flex-1" />
      <MixSwitch />
      <TransportSeparator />
      <MonitorControls />
    </div>
  );
}
