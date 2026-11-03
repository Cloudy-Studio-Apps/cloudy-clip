import { useEffect, useMemo } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import type { MeterLoop } from "../sound.types";
import { createMeterLoop } from "./meters.loop";

/**
 * The page's one meter loop: it reads the levels on every frame while the timeline plays and the
 * component that holds it is mounted, and nothing otherwise.
 */
export function useMeterLoop(): MeterLoop {
  const preview = useModule(previewRef);
  const loop = useMemo(() => createMeterLoop(preview.sound), [preview]);
  useEffect(() => {
    const { playback } = preview;
    const follow = () => (playback.isPlaying() ? loop.start() : loop.stop());
    follow();
    const off = playback.onPlayingChange(follow);
    return () => {
      off();
      loop.stop();
    };
  }, [loop, preview]);
  return loop;
}
