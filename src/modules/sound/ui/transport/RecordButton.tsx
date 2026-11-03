import { useStore } from "zustand";
import { useModule } from "@/core";
import { projectRef, useOpenComposition } from "@/modules/project";
import { IconButton } from "@/ui";
import { canArm } from "../../logic/record";
import { canRecordHere } from "../../sound.record.capture";
import { soundRef } from "../../sound.ref";
import { RecordDot } from "./RecordDot";
import { RecordingClock } from "./RecordingClock";

/**
 * Record in the transport row, a red mark: records the microphone from the playhead, playing as it
 * goes, onto the armed track, or onto a new Voice track when none is armed (or the armed one can't
 * take it). While it records it's filled red, a Stop, followed by the time the take has run; Stop
 * places the take. While the microphone opens and while the take is saved, the mark pulses and the
 * tooltip says which. Absent where recording doesn't work.
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
      <>
        <IconButton
          label="Stop recording and place the take"
          tone="mark-filled"
          onClick={() => void sound.recorder.stop()}
        >
          <RecordDot pulsing />
        </IconButton>
        <span className="ml-1 mr-1.5 shrink-0 text-sm text-mark">
          <RecordingClock />
        </span>
      </>
    );
  }
  if (status !== "idle") {
    return (
      <IconButton
        disabled
        busy
        tone="mark"
        label={status === "starting" ? "Opening the microphone" : "Saving the take"}
      >
        <RecordDot pulsing />
      </IconButton>
    );
  }

  const onto = canArm(track) && track.compositionId === open?.id ? track : null;
  return (
    <IconButton
      tone="mark"
      disabled={!open}
      label={
        onto
          ? `Record onto ${onto.name} (armed) from the playhead`
          : "Record onto a new Voice track from the playhead. To record onto a track of yours, arm it: R on its strip"
      }
      onClick={() => void sound.recorder.start(onto ? onto.id : null)}
    >
      <RecordDot />
    </IconButton>
  );
}
