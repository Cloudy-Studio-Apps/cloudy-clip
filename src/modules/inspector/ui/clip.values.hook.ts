import { useEffect, useMemo, useState } from "react";
import { useModule } from "@/core";
import { deepEqual } from "@/modules/element";
import { previewRef } from "@/modules/preview";
import { animatedClip, clampToClip, type Clip } from "@/modules/project";

/** Longest wait between redraws of the shown values while the clock runs. */
const PLAYING_INTERVAL_MS = 100;

/**
 * The clip with its animated values at the playhead, for showing in the panel. A clip with nothing
 * keyed comes back as itself and subscribes to nothing. Otherwise it follows the clock, at most
 * every 100 ms while playing, and re-renders only when a shown value changes.
 */
export function useClipAtPlayhead(clip: Clip): Clip {
  const { playback } = useModule(previewRef);
  const animated = clip.animation !== undefined;
  const now = useMemo(
    () => (animated ? animatedClip(clip, clampToClip(clip, playback.getTime())) : clip),
    [animated, clip, playback],
  );
  const [state, setState] = useState({ source: clip, value: now });

  useEffect(() => {
    if (!animated) return;
    let last = 0;
    const update = () => {
      const stamp = performance.now();
      if (playback.isPlaying() && stamp - last < PLAYING_INTERVAL_MS) return;
      last = stamp;
      const value = animatedClip(clip, clampToClip(clip, playback.getTime()));
      setState((prev) =>
        prev.source === clip && deepEqual(prev.value, value) ? prev : { source: clip, value },
      );
    };
    const offTime = playback.onTime(update);
    const offPlaying = playback.onPlayingChange(() => {
      last = 0;
      update();
    });
    return () => {
      offTime();
      offPlaying();
    };
  }, [animated, clip, playback]);

  if (!animated) return clip;
  return state.source === clip ? state.value : now;
}
