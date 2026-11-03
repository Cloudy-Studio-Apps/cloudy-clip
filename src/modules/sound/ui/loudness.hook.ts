import { useEffect } from "react";
import { useModule } from "@/core";
import { previewRef, type LoudnessReading } from "@/modules/preview";

/** How often the loudness is read, in ms: 10 Hz, as the worklet posts. */
export const LOUDNESS_INTERVAL_MS = 100;

/**
 * Calls `onReading` at 10 Hz while mounted with the latest loudness of the master (null while
 * nothing has been measured) and whether the timeline plays. Keep `onReading` stable and let it
 * write the DOM: no React state per reading (rule 24).
 */
export function useLoudnessFeed(
  onReading: (reading: LoudnessReading | null, playing: boolean) => void,
): void {
  const preview = useModule(previewRef);
  useEffect(() => {
    const read = () => onReading(preview.sound.loudness(), preview.playback.isPlaying());
    read();
    const timer = window.setInterval(read, LOUDNESS_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [preview, onReading]);
}
