import { createLogger } from "@/core";
import { MAX_DRIFT_SECONDS, driftSeek } from "../logic/drift";
import type { Slot } from "./engine.types";

const log = createLogger("preview.engine");

/** Keeps the element on the clock: plays/pauses it and seeks only when needed. */
export function syncSlot(slot: Slot, desired: number, playing: boolean): void {
  const element = slot.element;
  const drift = Math.abs(element.currentTime - desired);

  if (playing) {
    const target = driftSeek({
      current: element.currentTime,
      desired,
      duration: element.duration,
      seekTarget: slot.seekTarget,
      sinceSeekMs: performance.now() - slot.lastSeekAt,
      seekCost: slot.seekCost,
    });
    if (target !== null) seekSlot(slot, target);
    if (element.paused) {
      element.play().catch((error: unknown) => {
        // Autoplay with sound can be refused (e.g. playback started by an agent). Retry muted.
        if (!element.muted) {
          log.warn("Playback with sound was blocked; playing muted", error);
          element.muted = true;
          element.play().catch(() => undefined);
        }
      });
    }
    return;
  }

  if (!element.paused) element.pause();
  // While paused, aim for frame accuracy (half a frame at 60 fps).
  const pendingSeek =
    slot.seekTarget !== null && Math.abs(slot.seekTarget - desired) < MAX_DRIFT_SECONDS;
  if (drift > 0.008 && !pendingSeek) seekSlot(slot, desired);
}

/** Seeks an element and remembers it, so the same seek isn't issued every frame. */
export function seekSlot(slot: Slot, to: number): void {
  slot.seekTarget = to;
  slot.lastSeekAt = performance.now();
  slot.presented = false;
  slot.element.currentTime = to;
}
