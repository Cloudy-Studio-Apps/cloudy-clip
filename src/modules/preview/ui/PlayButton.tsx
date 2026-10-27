import { Pause, Play } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectDuration, projectRef } from "@/modules/project";
import { IconButton } from "@/ui";
import { togglePlay } from "../preview.commands";
import { previewRef } from "../preview.ref";

/** Plays or pauses the timeline. */
export function PlayButton() {
  const { playback } = useModule(previewRef);
  const { bus } = useKernel();
  const playing = useSyncExternalStore(playback.onPlayingChange, playback.isPlaying);
  const duration = useStore(useModule(projectRef).store.api, projectDuration);

  return (
    <IconButton
      variant="solid"
      label={playing ? "Pause (Space)" : "Play (Space)"}
      disabled={duration === 0}
      onClick={() => void bus.run(togglePlay, {})}
    >
      {playing ? <Pause strokeWidth={0} /> : <Play strokeWidth={0} />}
    </IconButton>
  );
}
