import { Pause, Play } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { compositionContent, projectRef, useOpenComposition } from "@/modules/project";
import { IconButton } from "@/ui";
import { togglePlay } from "../preview.commands";
import { previewRef } from "../preview.ref";

/** Plays or pauses the timeline. */
export function PlayButton() {
  const { playback } = useModule(previewRef);
  const { bus } = useKernel();
  const playing = useSyncExternalStore(playback.onPlayingChange, playback.isPlaying);
  const open = useOpenComposition();
  const content = useStore(useModule(projectRef).store.api, (s) =>
    open ? compositionContent(s, open.id) : 0,
  );

  return (
    <IconButton
      variant="solid"
      label={playing ? "Pause (Space)" : "Play (Space)"}
      disabled={content === 0}
      onClick={() => void bus.run(togglePlay, {})}
    >
      {playing ? <Pause strokeWidth={0} /> : <Play strokeWidth={0} />}
    </IconButton>
  );
}
