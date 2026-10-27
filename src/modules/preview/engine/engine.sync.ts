import { createLogger } from "@/core";
import type { Slot } from "./engine.types";

const log = createLogger("preview.engine");

/** While playing, a media element further than this from the clock is re-seeked. */
const MAX_DRIFT_SECONDS = 0.08;
/** After a seek while playing, give the element this long to catch up before seeking again. */
const SEEK_GRACE_MS = 500;

/** Keeps the element on the clock: plays/pauses it and seeks only when needed. */
export function syncSlot(slot: Slot, desired: number, playing: boolean): void {
  const element = slot.element;
  const drift = Math.abs(element.currentTime - desired);
  const pendingSeek =
    slot.seekTarget !== null && Math.abs(slot.seekTarget - desired) < MAX_DRIFT_SECONDS;

  if (playing) {
    const inGrace = performance.now() - slot.lastSeekAt < SEEK_GRACE_MS;
    const tooFar = drift > (inGrace ? 0.5 : MAX_DRIFT_SECONDS);
    if (tooFar && !pendingSeek) seekSlot(slot, desired);
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
  if (drift > 0.008 && !pendingSeek) seekSlot(slot, desired);
}

/** Seeks an element and remembers it, so the same seek isn't issued every frame. */
export function seekSlot(slot: Slot, to: number): void {
  slot.seekTarget = to;
  slot.lastSeekAt = performance.now();
  slot.presented = false;
  slot.element.currentTime = to;
}
