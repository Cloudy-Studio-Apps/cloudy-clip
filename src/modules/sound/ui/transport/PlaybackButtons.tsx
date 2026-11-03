import { SkipBack, Square } from "lucide-react";
import { useKernel } from "@/core";
import { pause, PlayButton, seek } from "@/modules/preview";
import { IconButton } from "@/ui";

/** Back to the start, play or pause, and stop: the user's playhead, through `preview`'s commands. */
export function PlaybackButtons() {
  const { bus } = useKernel();

  return (
    <>
      <IconButton label="Go to start (Home)" onClick={() => void bus.run(seek, { time: 0 })}>
        <SkipBack />
      </IconButton>
      <span className="mx-1 inline-grid shrink-0">
        <PlayButton />
      </span>
      <IconButton label="Stop" onClick={() => void bus.run(pause, {})}>
        <Square />
      </IconButton>
    </>
  );
}
