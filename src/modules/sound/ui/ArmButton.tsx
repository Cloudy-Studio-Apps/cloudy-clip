import { useStore } from "zustand";
import { useModule } from "@/core";
import type { Track } from "@/modules/project";
import { canArm } from "../logic/record";
import { canRecordHere } from "../sound.record.capture";
import { soundRef } from "../sound.ref";
import { StripToggle } from "./StripToggle";

/**
 * R on a strip: arms the track for recording, or disarms it. Record records onto the armed track,
 * or onto a new Voice track when none is armed. Offered only on an audio track that
 * isn't muted, and only where recording works (`RECORDING_CHECKED`).
 */
export function ArmButton({ track }: { track: Track }) {
  const sound = useModule(soundRef);
  const armed = useStore(sound.view, (s) => s.armed === track.id);
  if (!canRecordHere() || !canArm(track)) return null;
  return (
    <StripToggle
      on={armed}
      label={
        armed
          ? "Disarm: Record then goes onto a new Voice track"
          : "Arm: Record records onto this track (with none armed, onto a new Voice track)"
      }
      tone="mark"
      onToggle={() => sound.arm(armed ? null : track.id)}
    >
      R
    </StripToggle>
  );
}
