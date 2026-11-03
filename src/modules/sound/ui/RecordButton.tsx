import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { canArm } from "../logic/record";
import { canRecordHere } from "../sound.record.capture";
import { soundRef } from "../sound.ref";
import { TransportTool } from "./TransportTool";

/**
 * Record in the transport row: records the microphone onto the armed track from the playhead,
 * playing as it goes; Stop places the take. Absent where recording doesn't work.
 */
export function RecordButton() {
  const sound = useModule(soundRef);
  const project = useModule(projectRef).store;
  const open = useOpenComposition();
  const status = useStore(sound.recorder.state, (s) => s.status);
  const armed = useStore(sound.view, (s) => s.armed);
  const track = useStore(project.api, (s) => (armed === null ? undefined : s.tracks[armed]));
  if (!canRecordHere()) return null;

  const ready = canArm(track) && track.compositionId === open?.id;
  if (status === "recording") {
    return (
      <TransportTool
        pressed
        className="text-mark hover:text-mark"
        title="Stop recording and place the take"
        onClick={() => void sound.recorder.stop()}
      >
        Stop
      </TransportTool>
    );
  }
  return (
    <TransportTool
      disabled={status !== "idle" || !ready}
      title={
        status === "stopping"
          ? "Saving the take"
          : ready
            ? `Record onto ${track.name} from the playhead`
            : "Arm an audio track to record onto: R on its strip"
      }
      onClick={() => ready && void sound.recorder.start(track.id)}
    >
      {status === "stopping" ? "Saving" : "Record"}
    </TransportTool>
  );
}
