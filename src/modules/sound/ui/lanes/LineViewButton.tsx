import { useStore } from "zustand";
import { useModule } from "@/core";
import type { Track } from "@/modules/project";
import { LetterToggle } from "@/ui";
import { soundRef } from "../../sound.ref";

/**
 * L on an audio track's header: puts the track's volume line in front of its clips' lines, where
 * its points drag and Draw volume draws on it, or back behind them.
 */
export function LineViewButton({ track }: { track: Track }) {
  const sound = useModule(soundRef);
  const inFront = useStore(sound.view, (s) => s.lineView[track.id] ?? false);
  if (track.kind !== "audio") return null;
  return (
    <LetterToggle
      on={inFront}
      label={
        inFront
          ? "Track volume line in front: drag its points, draw on it. Click for the clips' lines"
          : "Bring the track's volume line in front of the clips' lines"
      }
      tone="ink"
      onToggle={() => sound.setLineView(track.id, !inFront)}
    >
      L
    </LetterToggle>
  );
}
