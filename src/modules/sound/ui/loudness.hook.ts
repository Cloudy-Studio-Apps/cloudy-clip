import { useEffect } from "react";
import { useModule } from "@/core";
import { previewRef, type LoudnessReading } from "@/modules/preview";

/** How often the loudness is read while playing, in ms: 10 Hz, as the worklet posts. */
export const LOUDNESS_INTERVAL_MS = 100;

/**
 * Calls `onReading` with the latest loudness of the master (null while nothing has been measured)
 * and whether the timeline plays: at 10 Hz while it plays, and once when it starts, stops and on
 * mount. Nothing runs while paused. Keep `onReading` stable and let it write the DOM: no React
 * state per reading (rule 24).
 */
export function useLoudnessFeed(
  onReading: (reading: LoudnessReading | null, playing: boolean) => void,
): void {
  const preview = useModule(previewRef);
  useEffect(() => {
    const { playback, sound } = preview;
    let timer = 0;
    const read = () => onReading(sound.loudness(), playback.isPlaying());
    const follow = () => {
      window.clearInterval(timer);
      timer = 0;
      read();
      if (playback.isPlaying()) timer = window.setInterval(read, LOUDNESS_INTERVAL_MS);
    };
    follow();
    const off = playback.onPlayingChange(follow);
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, [preview, onReading]);
}
