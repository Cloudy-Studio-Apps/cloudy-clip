import { createLogger } from "@/core";
import { MAX_DRIFT_SECONDS, driftSeek } from "../logic/drift";
import type { Slot } from "./engine.types";

const log = createLogger("preview.engine");

/** A ramp's rate moves every frame; a smaller change than this isn't worth setting. */
export const RAMP_RATE_STEP = 0.01;

/**
 * Keeps the element on the clock: plays/pauses it and seeks only when needed. `rate` is the
 * clip's rate now; on a ramp (`ramped`) it is set only when it moved by more than 0.01.
 */
export function syncSlot(
  slot: Slot,
  desired: number,
  playing: boolean,
  rate = 1,
  ramped = false,
): void {
  const element = slot.element;
  // Loading a file puts it back to 1, so this is checked every time.
  const step = ramped ? RAMP_RATE_STEP : 0;
  if (rate > 0 && Math.abs(element.playbackRate - rate) > step) element.playbackRate = rate;
  const drift = Math.abs(element.currentTime - desired);

  if (playing) {
    const target = driftSeek({
      current: element.currentTime,
      desired,
      duration: element.duration,
      seekTarget: slot.seekTarget,
      sinceSeekMs: performance.now() - slot.lastSeekAt,
      seekCost: slot.seekCost,
      rate,
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
  // A seek before the metadata can present frame 0 as if it were the target; `loadeddata` redraws.
  if (element.readyState < HTMLMediaElement.HAVE_METADATA) return;
  // While paused, aim for frame accuracy (half a frame at 60 fps).
  const pendingSeek =
    slot.seekTarget !== null && Math.abs(slot.seekTarget - desired) < MAX_DRIFT_SECONDS;
  if (drift > 0.008 && !pendingSeek) seekSlot(slot, desired);
}

/** Seeks an element and remembers it, so the same seek isn't issued every frame. */
export function seekSlot(slot: Slot, to: number): void {
  slot.seekTarget = to;
  slot.lastSeekAt = performance.now();
  slot.seeks += 1;
  slot.presented = false;
  slot.element.currentTime = to;
}
