import { createLogger, type Micros } from "@/core";
import { mediaUrl } from "@/modules/media";
import { projectDuration, projectStore } from "@/modules/project";
import { HtmlMediaEngine } from "./engine/html-media-engine";
import { createPlaybackClock } from "./playback-clock";
import type { PreviewEngine } from "./preview.types";

const log = createLogger("preview");

let duration: Micros = projectDuration(projectStore.getState());
projectStore.subscribe((state, previous) => {
  if (state.clips !== previous.clips) duration = projectDuration(state);
});

/** The app-wide playback clock. The timeline playhead and the preview both follow it. */
export const playback = createPlaybackClock(() => duration);

let engine: PreviewEngine | null = null;
let redrawQueued = false;

function renderNow(): void {
  redrawQueued = false;
  if (!engine) return;
  try {
    engine.render(projectStore.getState(), playback.getTime(), playback.isPlaying());
  } catch (error) {
    log.error("Render failed", error);
  }
}

/** Schedules one redraw on the next frame (coalesces bursts of events). */
function requestRedraw(): void {
  if (redrawQueued || playback.isPlaying()) return;
  redrawQueued = true;
  requestAnimationFrame(renderNow);
}

/**
 * Attaches the preview canvas. Rendering follows the clock while playing and redraws on demand
 * while paused (no idle CPU use). Returns a detach function.
 */
export function attachPreviewCanvas(canvas: HTMLCanvasElement): () => void {
  engine?.dispose();
  const current = new HtmlMediaEngine(canvas, { mediaUrl, onFrameReady: requestRedraw });
  engine = current;

  const offTime = playback.onTime(() => {
    if (playback.isPlaying()) renderNow();
    else requestRedraw();
  });
  const offPlaying = playback.onPlayingChange(() => {
    if (!playback.isPlaying()) engine?.pauseAll();
    requestRedraw();
  });
  // Keep the playhead inside the timeline when clips are removed or trimmed.
  const offProject = projectStore.subscribe(() => {
    if (playback.getTime() > duration) playback.seek(duration);
    requestRedraw();
  });

  return () => {
    offTime();
    offPlaying();
    offProject();
    if (engine === current) engine = null;
    current.dispose();
  };
}

/** Redraws after the canvas was resized. */
export function redrawPreview(): void {
  requestRedraw();
}

/**
 * Captures the preview as a base64 PNG, optionally at a given time. Waits (up to 3 s) until
 * every visible layer has decoded its frame, so the image matches the timeline.
 */
export async function capturePreviewFrame(time?: Micros): Promise<string> {
  if (!engine) throw new Error("The preview is not visible");
  if (time !== undefined) {
    playback.pause();
    playback.seek(time);
  }
  const deadline = performance.now() + 3000;
  for (;;) {
    renderNow();
    if (!engine) throw new Error("The preview was closed");
    if (engine.isSettled() || performance.now() > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  // Let pending seeks land, then draw the final frame.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  renderNow();
  return engine.captureFrame();
}
