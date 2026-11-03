import { createLogger, type Micros } from "@/core";
import type { ScrubDeps, Scrubber } from "./preview.types";

const log = createLogger("preview");

/** How long one slice of sound plays. */
export const SCRUB_SLICE_MS = 80;

/**
 * Audio scrub: each slice plays `SCRUB_SLICE_MS` of sound through the engine's graph. A call
 * during a slice waits for it to end, and only the latest waiting time plays next, so a fast
 * drag never piles slices up. The last slice ending stops media and redraws the paused frame.
 */
export function createScrub(deps: ScrubDeps): Scrubber {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Micros | null = null;
  /** Where the slice playing started, and when. */
  let from: Micros = 0;
  let startedAt = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  /** Plays the engine at `time`; `start` seeks there first. False when nothing can play. */
  function play(time: Micros, start: boolean): boolean {
    const engine = deps.engine();
    const composition = deps.getComposition();
    if (!engine || !composition || deps.clock.isPlaying()) return false;
    try {
      const { transforms, propsOverrides } = deps;
      engine.playSlice(deps.getProject(), composition, time, start, transforms, propsOverrides);
    } catch (error) {
      log.error("Scrub failed", error);
    }
    return true;
  }

  function start(time: Micros): boolean {
    if (!play(time, true)) return false;
    from = time;
    startedAt = performance.now();
    timer = setTimeout(end, SCRUB_SLICE_MS);
    return true;
  }

  function end(): void {
    timer = null;
    const next = pending;
    pending = null;
    if (next !== null && start(next)) return;
    deps.engine()?.pauseAll();
    deps.redraw();
    emit();
  }

  function cancel(): void {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    pending = null;
    emit();
  }

  return {
    scrub(time) {
      if (timer !== null) pending = time;
      else if (start(time)) emit();
    },
    scrubbing: () => timer !== null,
    drawSlice() {
      if (timer === null) return false;
      // Playing took over: the slice goes and the frame renders as playback.
      if (deps.clock.isPlaying()) {
        cancel();
        return false;
      }
      // Goes on where the slice has got to, without seeking, drawing its frame once decoded.
      play(from + Math.round((performance.now() - startedAt) * 1000), false);
      return true;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
      listeners.clear();
    },
  };
}
