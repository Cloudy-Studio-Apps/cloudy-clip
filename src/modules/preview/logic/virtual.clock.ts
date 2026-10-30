import type { Micros } from "@/core";
import type { PlaybackClock, TimeListener } from "../preview.types";

/**
 * A collaborator's playhead. Nothing is drawn or played: time is worked out from the wall clock
 * when read, so it needs no frames and keeps going while the window is hidden.
 *
 * @param getDuration Length of the timeline.
 * @param startAt Where the playhead starts.
 */
export function createVirtualClock(getDuration: () => Micros, startAt: Micros): PlaybackClock {
  let anchorTime = startAt;
  let anchorNow = 0;
  let playing = false;
  const timeListeners = new Set<TimeListener>();
  const playingListeners = new Set<() => void>();

  function read(): Micros {
    const elapsed = playing ? Math.round((performance.now() - anchorNow) * 1000) : 0;
    return Math.min(anchorTime + elapsed, Math.max(0, getDuration()));
  }

  function setPlaying(next: boolean): void {
    if (playing === next) return;
    playing = next;
    for (const listener of playingListeners) listener();
  }

  function emitTime(): void {
    const time = read();
    for (const listener of timeListeners) listener(time);
  }

  function anchor(time: Micros): void {
    anchorTime = time;
    anchorNow = performance.now();
  }

  return {
    getTime: read,
    isPlaying() {
      if (playing && read() >= getDuration()) {
        anchor(read());
        setPlaying(false);
      }
      return playing;
    },
    play() {
      const duration = getDuration();
      if (playing || duration <= 0) return;
      anchor(read() >= duration ? 0 : read());
      setPlaying(true);
      emitTime();
    },
    pause() {
      if (!playing) return;
      anchor(read());
      setPlaying(false);
      emitTime();
    },
    seek(next) {
      anchor(Math.min(Math.max(0, Math.round(next)), Math.max(0, getDuration())));
      emitTime();
    },
    onTime(listener) {
      timeListeners.add(listener);
      listener(read());
      return () => timeListeners.delete(listener);
    },
    onPlayingChange(listener) {
      playingListeners.add(listener);
      return () => playingListeners.delete(listener);
    },
    dispose() {
      timeListeners.clear();
      playingListeners.clear();
    },
  };
}
