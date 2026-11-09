import type { PreviewApi } from "@/modules/preview";

/** The widest frame the scopes read from the preview. */
const READ_WIDTH = 256;
/** While playing the scopes read at most this often (about 15 Hz), in milliseconds. */
const PLAYING_GAP = 66;

/** A running scopes loop. */
export interface ScopesLoop {
  /** Paints again (a size, scope or theme change) from the last frame read, without reading. */
  invalidate(): void;
  stop(): void;
}

/**
 * One animation-frame loop for the scopes panel. It reads the preview's drawn frame at most 15 Hz
 * while playing, and once after each drawn frame while paused, then hands it to `paint`. No React
 * state is touched; `paint` draws on canvases directly.
 */
export function startScopesLoop(
  preview: Pick<PreviewApi, "picture" | "playback">,
  paint: (frame: ImageData | null) => void,
): ScopesLoop {
  let frame: ImageData | null = null;
  let stale = true;
  let repaint = true;
  let lastRead = -Infinity;
  const off = preview.picture.onFrame(() => {
    stale = true;
  });
  const tick = (now: number) => {
    handle = requestAnimationFrame(tick);
    if (stale && (!preview.playback.isPlaying() || now - lastRead >= PLAYING_GAP)) {
      frame = preview.picture.readFrame(READ_WIDTH);
      lastRead = now;
      stale = false;
      repaint = true;
    }
    if (repaint) {
      repaint = false;
      paint(frame);
    }
  };
  let handle = requestAnimationFrame(tick);
  return {
    invalidate() {
      repaint = true;
    },
    stop() {
      cancelAnimationFrame(handle);
      off();
    },
  };
}
