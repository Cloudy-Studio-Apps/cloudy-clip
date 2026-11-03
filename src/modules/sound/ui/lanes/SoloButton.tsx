import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import type { Track } from "@/modules/project";
import { LetterToggle } from "@/ui";
import { setSolo } from "../../sound.monitor.commands";
import { soundRef } from "../../sound.ref";

/** S on a track's header and on its mixer strip: solos the track, or lets it go (`sound.setSolo`). */
export function SoloButton({ track }: { track: Track }) {
  const { bus } = useKernel();
  const soloed = useStore(useModule(soundRef).view, (s) => s.solo.includes(track.id));
  return (
    <LetterToggle
      on={soloed}
      label={soloed ? "Stop soloing" : "Solo track"}
      tone="ink"
      onToggle={() => void bus.run(setSolo, { trackId: track.id, on: !soloed })}
    >
      S
    </LetterToggle>
  );
}
