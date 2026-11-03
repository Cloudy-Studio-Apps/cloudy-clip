import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { canArm } from "../logic/record";
import { canRecordHere } from "../sound.record.capture";
import { soundRef } from "../sound.ref";
import { RecordDot } from "./RecordDot";
import { RecordingClock } from "./RecordingClock";
import { TransportTool } from "./TransportTool";

/**
 * Record in the transport row: records the microphone from the playhead, playing as it goes, onto
 * the armed track, or onto a new Voice track when none is armed (or the armed one can't take it).
 * While it records it's a red Stop with the time the take has run; Stop places the take. Absent
 * where recording doesn't work.
 */
export function RecordButton() {
  const sound = useModule(soundRef);
  const project = useModule(projectRef).store;
  const open = useOpenComposition();
  const status = useStore(sound.recorder.state, (s) => s.status);
  const armed = useStore(sound.view, (s) => s.armed);
  const track = useStore(project.api, (s) => (armed === null ? undefined : s.tracks[armed]));
  if (!canRecordHere()) return null;

  if (status === "recording") {
    return (
      <TransportTool
        className="flex items-center gap-1.5 bg-mark text-mark-foreground hover:bg-mark-hover hover:text-mark-foreground"
        title="Stop recording and place the take"
        onClick={() => void sound.recorder.stop()}
      >
        <RecordDot pulsing />
        Stop
        <RecordingClock />
      </TransportTool>
    );
  }
  if (status !== "idle") {
    const starting = status === "starting";
    return (
      <TransportTool
        disabled
        className="flex cursor-default items-center gap-1.5 text-mark hover:text-mark"
        title={starting ? "Opening the microphone" : "Saving the take"}
      >
        <RecordDot pulsing={starting} />
        {starting ? "Starting…" : "Saving…"}
      </TransportTool>
    );
  }

  const onto = canArm(track) && track.compositionId === open?.id ? track : null;
  return (
    <TransportTool
      className="flex items-center gap-1.5 [&>span]:text-mark"
      disabled={!open}
      title={
        onto
          ? `Record onto ${onto.name} (armed) from the playhead`
          : "Record onto a new Voice track from the playhead. To record onto a track of yours, arm it: R on its strip"
      }
      onClick={() => void sound.recorder.start(onto ? onto.id : null)}
    >
      <RecordDot />
      Record
    </TransportTool>
  );
}
