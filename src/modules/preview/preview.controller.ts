import { createLogger, type Micros } from "@/core";
import type { PreviewController, PreviewControllerDeps, PreviewEngine } from "./preview.types";

const log = createLogger("preview");

/** While paused, frames still decoding are retried for at most this many animation frames. */
const MAX_SETTLE_RETRIES = 180;

/**
 * Creates the preview controller of one kernel. Rendering follows the clock while playing and
 * redraws on demand while paused (no idle CPU use).
 */
export function createPreviewController(deps: PreviewControllerDeps): PreviewController {
  const { clock } = deps;
  let engine: PreviewEngine | null = null;
  let detachCurrent: (() => void) | null = null;
  let redrawQueued = false;
  let settleRetries = 0;

  function renderNow(): void {
    redrawQueued = false;
    if (!engine) return;
    try {
      engine.render(deps.getProject(), clock.getTime(), clock.isPlaying());
    } catch (error) {
      log.error("Render failed", error);
    }
    // A layer is still decoding: try again next frame (bounded, so a stuck file can't spin).
    if (!clock.isPlaying() && !engine.isSettled() && settleRetries < MAX_SETTLE_RETRIES) {
      settleRetries++;
      scheduleRedraw();
    }
  }

  function scheduleRedraw(): void {
    if (redrawQueued || clock.isPlaying()) return;
    redrawQueued = true;
    deps.requestFrame(renderNow);
  }

  /** Schedules one redraw on the next frame (coalesces bursts of events). */
  function requestRedraw(): void {
    settleRetries = 0;
    scheduleRedraw();
  }

  function attachCanvas(canvas: HTMLCanvasElement): () => void {
    detachCurrent?.();
    const current = deps.createEngine(canvas, requestRedraw);
    engine = current;

    const offTime = clock.onTime(() => {
      if (clock.isPlaying()) renderNow();
      else requestRedraw();
    });
    const offPlaying = clock.onPlayingChange(() => {
      if (!clock.isPlaying()) engine?.pauseAll();
      requestRedraw();
    });
    // Keep the playhead inside the timeline when clips are removed or trimmed.
    const offProject = deps.subscribeProject(() => {
      const duration = deps.getDuration();
      if (clock.getTime() > duration) clock.seek(duration);
      requestRedraw();
    });
    // A proxy becoming ready changes a file's URL; redraw so the engine reloads it.
    const offMedia = deps.subscribeMedia(requestRedraw);

    const detach = () => {
      if (detachCurrent !== detach) return;
      detachCurrent = null;
      offTime();
      offPlaying();
      offProject();
      offMedia();
      if (engine === current) engine = null;
      current.dispose();
    };
    detachCurrent = detach;
    return detach;
  }

  async function captureFrame(time?: Micros): Promise<string> {
    if (!engine) throw new Error("The preview is not visible");
    if (time !== undefined) {
      clock.pause();
      clock.seek(time);
    }
    const deadline = performance.now() + 3000;
    for (;;) {
      renderNow();
      if (!engine) throw new Error("The preview was closed");
      if (engine.isSettled() || performance.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    // Let pending seeks land, then draw the final frame.
    await new Promise<void>((resolve) => deps.requestFrame(resolve));
    renderNow();
    if (!engine) throw new Error("The preview was closed");
    return engine.captureFrame();
  }

  return {
    playback: clock,
    attachCanvas,
    redraw: requestRedraw,
    captureFrame,
    dispose() {
      clock.pause();
      detachCurrent?.();
    },
  };
}
