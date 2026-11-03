import type { Micros } from "@/core";
import type { ScrubDeps, Scrubber } from "./preview.types";

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

  function start(time: Micros): boolean {
    if (!deps.playSlice(time)) return false;
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
    deps.stop();
    emit();
  }

  return {
    scrub(time) {
      if (timer !== null) pending = time;
      else if (start(time)) emit();
    },
    at: () => (timer === null ? null : from + Math.round((performance.now() - startedAt) * 1000)),
    cancel() {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      pending = null;
      emit();
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
