import type { Micros } from "@/core";
import type { PlaybackClock, TimeListener } from "./preview.types";

/**
 * Creates the playback clock. Time advances from `performance.now()` (not from media
 * elements), so it stays smooth even when a video stalls; the engine follows the clock.
 *
 * @param getDuration Length of the timeline; playback stops at the end.
 */
export function createPlaybackClock(getDuration: () => Micros): PlaybackClock {
  let time: Micros = 0;
  let playing = false;
  let anchorTime: Micros = 0;
  let anchorNow = 0;
  let frame = 0;
  const timeListeners = new Set<TimeListener>();
  const playingListeners = new Set<() => void>();

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
    time = Math.round(anchorTime + (now - anchorNow) * 1000);
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
    dispose() {
      cancelAnimationFrame(frame);
      timeListeners.clear();
      playingListeners.clear();
    },
  };
}
