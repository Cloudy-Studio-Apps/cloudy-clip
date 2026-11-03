import { useEffect, useMemo } from "react";
import { useModule } from "@/core";
import { previewRef } from "@/modules/preview";
import { soundRef } from "../sound.ref";
import type { MeterLoop } from "../sound.types";
import { createMeterLoop } from "./meters.loop";

/**
 * The page's one meter loop: it reads the levels on every frame while the timeline plays (or a
 * scrub slice sounds, or a take is recorded) and the component that holds it is mounted, and
 * nothing otherwise.
 */
export function useMeterLoop(): MeterLoop {
  const preview = useModule(previewRef);
  const { recorder } = useModule(soundRef);
  const loop = useMemo(() => createMeterLoop(preview.sound, recorder.level), [preview, recorder]);
  useEffect(() => {
    const { playback } = preview;
    const sounding = () =>
      playback.isPlaying() ||
      preview.isScrubbing() ||
      recorder.state.getState().status === "recording";
    const follow = () => (sounding() ? loop.start() : loop.stop());
    follow();
    const off = playback.onPlayingChange(follow);
    const offScrub = preview.onScrubbingChange(follow);
    const offRecording = recorder.state.subscribe(follow);
    return () => {
      off();
      offScrub();
      offRecording();
      loop.stop();
    };
  }, [loop, preview, recorder]);
  return loop;
}
