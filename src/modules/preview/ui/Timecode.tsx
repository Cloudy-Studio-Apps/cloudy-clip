import { useEffect, useRef } from "react";
import { formatTimecode, useModule } from "@/core";
import { useOpenComposition } from "@/modules/project";
import { previewRef } from "../preview.ref";

/** Current time / project length. The current time updates without React renders. */
export function Timecode() {
  const { playback } = useModule(previewRef);
  const duration = useOpenComposition()?.duration ?? 0;
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      playback.onTime((time) => {
        if (timeRef.current) timeRef.current.textContent = formatTimecode(time);
      }),
    [playback],
  );

  return (
    <span className="font-mono text-sm tabular-nums">
      <span ref={timeRef}>{formatTimecode(playback.getTime())}</span>
      <span className="text-muted-foreground"> / {formatTimecode(duration)}</span>
    </span>
  );
}
