import { useEffect, useMemo } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import type { MeterLoop } from "../sound.types";
import { createMeterLoop } from "./meters.loop";

/**
 * The page's one meter loop: it reads the levels on every frame while the timeline plays (or a
 * scrub slice sounds) and the component that holds it is mounted, and nothing otherwise.
 */
export function useMeterLoop(): MeterLoop {
  const preview = useModule(previewRef);
  const loop = useMemo(() => createMeterLoop(preview.sound), [preview]);
  useEffect(() => {
    const { playback } = preview;
    const sounding = () => playback.isPlaying() || preview.isScrubbing();
    const follow = () => (sounding() ? loop.start() : loop.stop());
    follow();
    const off = playback.onPlayingChange(follow);
    const offScrub = preview.onScrubbingChange(follow);
    return () => {
      off();
      offScrub();
      loop.stop();
    };
  }, [loop, preview]);
  return loop;
}
