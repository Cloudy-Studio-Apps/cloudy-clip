import type { Micros } from "@/core";
import { fitLoop, loopTime } from "./logic/loop";
import type { LoopRange, PlaybackClock, TimeListener } from "./preview.types";

/**
 * Creates the playback clock. Time advances from `performance.now()` (not from media
 * elements), so it stays smooth even when a video stalls; the engine follows the clock.
 *
 * @param getDuration Length of the timeline; playback stops at the end.
 * @param getFrame Length of one frame of the timeline: the shortest loop.
 */
export function createPlaybackClock(
  getDuration: () => Micros,
  getFrame: () => Micros,
): PlaybackClock {
  let time: Micros = 0;
  let playing = false;
  let anchorTime: Micros = 0;
  let anchorNow = 0;
  let frame = 0;
  let loop: LoopRange | null = null;
  const timeListeners = new Set<TimeListener>();
  const playingListeners = new Set<() => void>();
  const loopListeners = new Set<() => void>();

  function emitTime(): void {
    for (const listener of timeListeners) listener(time);
  }

  function setPlaying(next: boolean): void {
    if (playing === next) return;
    playing = next;
    for (const listener of playingListeners) listener();
  }

  function tick(now: number): void {
    if (!playing) return;
    const duration = getDuration();
    time = loopTime(anchorTime, Math.round(anchorTime + (now - anchorNow) * 1000), loop);
    if (time >= duration) {
      time = duration;
      setPlaying(false);
    } else {
      frame = requestAnimationFrame(tick);
    }
    emitTime();
  }

  return {
    getTime: () => time,
    isPlaying: () => playing,
    play() {
      if (playing) return;
      const duration = getDuration();
      if (duration <= 0) return;
      if (time >= duration) time = 0;
      anchorTime = time;
      anchorNow = performance.now();
      setPlaying(true);
      frame = requestAnimationFrame(tick);
      emitTime();
    },
    pause() {
      if (!playing) return;
      cancelAnimationFrame(frame);
      setPlaying(false);
      emitTime();
    },
    seek(next) {
      time = Math.min(Math.max(0, Math.round(next)), Math.max(0, getDuration()));
      anchorTime = time;
      anchorNow = performance.now();
      emitTime();
    },
    onTime(listener) {
      timeListeners.add(listener);
      listener(time);
      return () => timeListeners.delete(listener);
    },
    onPlayingChange(listener) {
      playingListeners.add(listener);
      return () => playingListeners.delete(listener);
    },
    getLoop: () => loop,
    setLoop(range) {
      const next = range && fitLoop(range, getDuration(), getFrame());
      if (range && !next) return false;
      if (next?.from === loop?.from && next?.to === loop?.to) return true;
      // Counted from now: a loop set mid-play only wraps once the playhead crosses its end.
      const now = performance.now();
      if (playing)
        time = loopTime(anchorTime, Math.round(anchorTime + (now - anchorNow) * 1000), loop);
      anchorTime = time;
      anchorNow = now;
      loop = next;
      for (const listener of loopListeners) listener();
      return true;
    },
    onLoopChange(listener) {
      loopListeners.add(listener);
      return () => loopListeners.delete(listener);
    },
    dispose() {
      cancelAnimationFrame(frame);
      timeListeners.clear();
      playingListeners.clear();
      loopListeners.clear();
    },
  };
}
