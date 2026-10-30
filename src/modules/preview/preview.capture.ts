import type { Micros } from "@/core";
import type { FontRequest } from "@/modules/fonts";
import type { PreviewCapture, PreviewCaptureDeps, PreviewEngine } from "./preview.types";

/** How long a frame may take to decode. */
const SETTLE_LIMIT_MS = 3000;
/** Pause between looks at the decoders. Timers, not frames: frames stop on a hidden window. */
const SETTLE_POLL_MS = 30;
/** The offscreen engine holds decoders, so it goes once nobody has captured for this long. */
const IDLE_DISPOSE_MS = 30_000;

/**
 * Captures frames on an engine of its own, on a canvas that is never shown. It shares nothing
 * with the user's preview, so it doesn't move their playhead, and it works with the window hidden
 * or the preview panel closed.
 */
export function createCapture(deps: PreviewCaptureDeps): PreviewCapture {
  let engine: PreviewEngine | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let waitingForFont = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  function ensureFont(request: FontRequest): boolean {
    const ready = deps.ensureFont(request);
    if (!ready) waitingForFont = true;
    return ready;
  }

  function drop(): void {
    clearTimeout(idleTimer);
    engine?.dispose();
    engine = null;
    canvas = null;
  }

  async function capture(time: Micros): Promise<string> {
    clearTimeout(idleTimer);
    const project = deps.getProject();
    canvas ??= document.createElement("canvas");
    engine ??= deps.createEngine(canvas, ensureFont);
    canvas.width = project.format.width;
    canvas.height = project.format.height;

    const deadline = performance.now() + SETTLE_LIMIT_MS;
    for (;;) {
      waitingForFont = false;
      engine.render(project, time, false);
      const settled = engine.isSettled();
      if (settled && !waitingForFont) break;
      if (performance.now() > deadline) {
        // A font that won't load falls back to Inter; a frame that won't decode has no fallback.
        if (settled) break;
        throw new Error("The frame did not decode in time");
      }
      await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
    }
    const data = await engine.captureFrame();
    idleTimer = setTimeout(drop, IDLE_DISPOSE_MS);
    return data;
  }

  return {
    captureAt(time) {
      const result = queue.then(() => capture(time));
      queue = result.catch(() => undefined);
      return result;
    },
    dispose: drop,
  };
}
